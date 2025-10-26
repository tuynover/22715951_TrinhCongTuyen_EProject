const chai = require("chai");
const chaiHttp = require("chai-http");
const App = require("../app");
const expect = chai.expect;
require("dotenv").config();

chai.use(chaiHttp);

describe("Products (via API Gateway)", () => {
  let app;
  let authToken;

  before(async () => {
    app = new App();
    await Promise.all([app.connectDB(), app.setupMessageBroker()]);
    app.start();

    // ✅ Đăng nhập qua API Gateway
    const authRes = await chai
      .request("http://localhost:3003") // ✅ Gateway endpoint
      .post("/auth/login")              // ✅ Route trong Gateway
      .send({
        username: process.env.LOGIN_TEST_USER,
        password: process.env.LOGIN_TEST_PASSWORD,
      });

    expect(authRes).to.have.status(200);
    expect(authRes.body).to.have.property("token");
    authToken = authRes.body.token;
    console.log("✅ JWT token:", authToken);
  });

  after(async () => {
    await app.disconnectDB();
    app.stop();
  });

  describe("POST /products", () => {
    it("should create a new product", async () => {
      const product = {
        name: "Product 1",
        description: "Description of Product 1",
        price: 10,
      };

      const res = await chai
        .request("http://localhost:3003") // ✅ Gateway chứ không phải app.app
        .post("/products")
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property("name", product.name);
    });

    it("should return an error if name is missing", async () => {
      const product = {
        description: "No name product",
        price: 9.99,
      };

      const res = await chai
        .request("http://localhost:8000")
        .post("/products")
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(400);
    });
  });
});
