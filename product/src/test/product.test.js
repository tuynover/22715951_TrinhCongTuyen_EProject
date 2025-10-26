const chai = require("chai");
const chaiHttp = require("chai-http");
const jwt = require("jsonwebtoken"); // 👈 thêm dòng này
const App = require("../app");
const expect = chai.expect;
require("dotenv").config();

chai.use(chaiHttp);

describe("Products", () => {
  let app;
  let authToken;

  before(async () => {
    app = new App();
    await Promise.all([app.connectDB(), app.setupMessageBroker()]);

    // ⚙️ Nếu đang chạy local → gọi thật Auth service
    if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
      try {
        const authRes = await chai
          .request("http://localhost:3000")
          .post("/login")
          .send({
            username: process.env.LOGIN_TEST_USER,
            password: process.env.LOGIN_TEST_PASSWORD,
          });

        authToken = authRes.body.token;
        console.log("🔑 Authenticated token:", authToken);
      } catch (err) {
        console.error("⚠️ Auth service not available, using mock token");
      }
    } else {
      // 🧪 CI/CD: tạo token JWT giả hợp lệ
      console.log("🧪 Running in CI/CD → generating mock JWT");
      authToken = jwt.sign(
        { username: "ci_user", role: "tester" },
        process.env.JWT_SECRET || "your_jwt_secret_here",
        { expiresIn: "1h" }
      );
    }

    app.start();
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
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(201);
      expect(res.body).to.have.property("_id");
      expect(res.body).to.have.property("name", product.name);
      expect(res.body).to.have.property("description", product.description);
      expect(res.body).to.have.property("price", product.price);
    });

    it("should return an error if name is missing", async () => {
      const product = {
        description: "Description of Product 1",
        price: 10.99,
      };

      const res = await chai
        .request(app.app)
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(400);
    });
  });
});