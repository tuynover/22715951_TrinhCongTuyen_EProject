require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3001,
  mongoURI: process.env.MONGODB_PRODUCT_URI || "mongodb://mongo:27017/products",
  rabbitMQURI: process.env.RABBITMQ_URL || "amqp://rabbitmq:5672",
  exchangeName: "products",
  queueName: "products_queue",
};