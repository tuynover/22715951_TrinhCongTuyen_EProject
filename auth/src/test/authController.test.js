const chai = require("chai");
const chaiHttp = require("chai-http");
const App = require("../app");
const mongoose = require("mongoose"); // Cần import Mongoose để kiểm tra trạng thái kết nối
require("dotenv").config();


chai.use(chaiHttp);
const { expect } = chai;

describe("User Authentication", () => {
    let appInstance;
    let server;

    // --- HOOK TRƯỚC TẤT CẢ CÁC BÀI TEST ---
    before(async () => {
        // 1. Khởi tạo App (Điều này gọi connectDB() bất đồng bộ trong constructor)
        appInstance = new App();
        
        // 2. Đảm bảo kết nối DB đã mở trước khi chạy bất kỳ test nào.
        // Điều này khắc phục lỗi "buffering timed out" (users.findOne()).
        // Chúng ta chờ sự kiện 'open' trên kết nối Mongoose.
        if (mongoose.connection.readyState === 0) {
            await new Promise(resolve => {
                mongoose.connection.once('open', resolve);
            });
        }
        
        // 3. Khởi động server và CHỜ server sẵn sàng lắng nghe
        // Server instance được lưu vào appInstance.server trong app.start().
        await new Promise(resolve => {
            appInstance.start(); 
            appInstance.server.on('listening', resolve);
        });

        // Gán server instance cho chai-http sử dụng
        server = appInstance.server;
        
        // Dọn dẹp dữ liệu (phải chạy SAU KHI DB ĐÃ KẾT NỐI)
        await appInstance.authController.authService.deleteTestUsers();
    });

    // --- HOOK SAU TẤT CẢ CÁC BÀI TEST ---
    after(async () => {
        // 1. Dọn dẹp dữ liệu (phải chạy TRƯỚC khi ngắt DB)
        await appInstance.authController.authService.deleteTestUsers();
        
        // 2. Đóng server và CHỜ đóng hoàn tất (khắc phục lỗi timeout trong after hook)
        // Chúng ta gọi server.close() và chờ Promise resolve
        await new Promise(resolve => {
            if (appInstance.server) {
                appInstance.server.close(resolve); 
            } else {
                resolve();
            }
        });

        // 3. Ngắt kết nối DB
        await appInstance.disconnectDB(); 
    });

    describe("POST /register", () => {
        it("should register a new user", async () => {
            // SỬA: Sử dụng biến server đã được gán instance HTTP
            const res = await chai
                .request(server) 
                .post("/register")
                .send({ username: "admin", password: "123" });

            // Lỗi 1 của bạn là expected 200 but got 400. 
            // Giả định logic server đã được sửa để trả về 200 cho thành công
            expect(res).to.have.status(200); 
            expect(res.body).to.have.property("_id");
            expect(res.body).to.have.property("username", "admin");
        });

        it("should return an error if the username is already taken", async () => {
            const res = await chai
                .request(server)
                .post("/register")
                .send({ username: "admin", password: "123" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("message", "Username already taken");
        });
    });

    describe("POST /login", () => {
        it("should return a JWT token for a valid user", async () => {
            // SỬA: Sử dụng biến server đã được gán instance HTTP
            const res = await chai
                .request(server)
                .post("/login")
                .send({ username: "admin", password: "123" });

            expect(res).to.have.status(200);
            expect(res.body).to.have.property("token");
        });

        it("should return an error for an invalid user", async () => {
            const res = await chai
                .request(server)
                .post("/login")
                .send({ username: "invaliduser", password: "password" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("message", "Invalid username or password");
        });

        it("should return an error for an incorrect password", async () => {
            const res = await chai
                .request(server)
                .post("/login")
                .send({ username: "admin", password: "wrongpass" });

            expect(res).to.have.status(400);
            expect(res.body).to.have.property("message", "Invalid username or password");
        });
    });
});
