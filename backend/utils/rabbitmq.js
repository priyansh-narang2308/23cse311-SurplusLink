import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'notification_queue';

let connection = null;
let channel = null;

export const connectRabbitMQ = async () => {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log('✅ Connected to RabbitMQ');
    return { connection, channel };
  } catch (error) {
    console.error('❌ RabbitMQ Connection Error:', error);
    // In US 9.1, we want graceful degradation, so we don't crash the server
    return null;
  }
};

export const publishToQueue = async (data) => {
  try {
    if (!channel) {
      console.warn('⚠️ RabbitMQ channel not available. Falling back to synchronous processing.');
      return false;
    }
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), {
      persistent: true,
    });
    return true;
  } catch (error) {
    console.error('❌ Error publishing to RabbitMQ:', error);
    return false;
  }
};

export const consumeFromQueue = async (callback) => {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }
    if (channel) {
      channel.consume(QUEUE_NAME, async (msg) => {
        if (msg !== null) {
          const content = JSON.parse(msg.content.toString());
          await callback(content);
          channel.ack(msg);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error consuming from RabbitMQ:', error);
  }
};
