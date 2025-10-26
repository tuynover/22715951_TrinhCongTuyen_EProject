const chai = require("chai");
const chaiHttp = require("chai-http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose"); // Cần thiết để kiểm tra trạng thái DB
const App = require("../app");
const Product = require("../models/product"); // Cần thiết cho việc dọn dẹp
const expect = chai.expect;
require("dotenv").config();

chai.use(chaiHttp);

describe("Products", () => {
  let appInstance;
  let server; // Lưu trữ instance HTTP Server đang chạy
  let authToken;

  before(async () => {
    appInstance = new App();
    
    // 1. CHẠY TUẦN TỰ: Đảm bảo DB được kết nối 
    await appInstance.connectDB(); 
    
    // 2. CHỜ DB SẴN SÀNG: Sử dụng Promise để chờ trạng thái 'open' một cách an toàn.
    // Điều này khắc phục lỗi "buffering timed out".
    if (mongoose.connection.readyState !== 1) { // 1 = Connected
        console.log("Waiting for Mongoose connection to open...");
        await new Promise(resolve => {
            // Chờ sự kiện kết nối mở (chỉ chạy một lần)
            mongoose.connection.once('open', resolve); 
        });
        console.log("Mongoose connection ready.");
    }

    // [ĐÃ LOẠI BỎ] Lệnh gọi appInstance.setupMessageBroker() đã bị xóa.
    // Nếu controller vẫn gọi Broker, cần đảm bảo Broker trả về kết quả giả.
    
    // 3. Dọn dẹp dữ liệu cũ (Bây giờ đã an toàn để chạy query DB)
    await Product.deleteMany({}); 

    // ⚙️ Logic tạo Token (CI/CD)
    if (!process.env.CI && !process.env.GITHUB_ACTIONS) {
      // Logic gọi thật Auth service... (Giữ nguyên)
      try {
        const authRes = await chai
          .request("http://localhost:3000")
          .post("/login")
          .send({
            username: process.env.LOGIN_TEST_USER,
            password: process.env.LOGIN_TEST_PASSWORD,
          });
        authToken = authRes.body.token;
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
    
    // 4. Khởi động server và chờ nó lắng nghe
    server = appInstance.start(); 
    await new Promise(resolve => server.on('listening', resolve));
  });

  after(async () => {
    // 1. Dọn dẹp dữ liệu sau khi hoàn tất test suite
    if (mongoose.connection.readyState === 1) {
        await Product.deleteMany({}); 
    }
    
    // 2. Đóng server an toàn (khắc phục lỗi Timeout)
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    
    // 3. Ngắt kết nối DB
    await appInstance.disconnectDB();
  });

  describe("POST /api/products", () => {
    it("should create a new product", async () => {
      const product = {
        name: "Product 1",
        description: "Description of Product 1",
        price: 10,
      };

      const res = await chai
        .request(server) // SỬ DỤNG SERVER INSTANCE ĐANG CHẠY
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
        .request(server) // SỬ DỤNG SERVER INSTANCE ĐANG CHẠY
        .post("/")
        .set("Authorization", `Bearer ${authToken}`)
        .send(product);

      expect(res).to.have.status(400);
    });
  });
});
