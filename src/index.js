import Dotenv from 'dotenv';
import Hapi from 'hapi';
import Nexmo from 'nexmo';

// Load any local ENV
Dotenv.load({ silent: true });

// Load and config NEXMO
const nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET,
  applicationId: process.env.NEXMO_APP_ID,
  privateKey: process.env.NEXMO_APP_ID
});

// Setup Hapi
const server = new Hapi.Server();
server.connection({ port: 8000, host: 'localhost' });

// Base route
server.route({
  method: 'GET',
  path: '/',
  handler: (request, reply) => {
    reply('Hackference conference quiz!');
  }
});

// Webhook for nexmo
server.route({
  method: ['GET', 'POST'],
  path: '/nexmo-webhook',
  handler: (request, reply) => {
    console.log(request.query);
    let response;
    let message = request.query.text;
    let regex = /([0-9]+)[ ]?([A-D]?)/gi;
    let found = regex.exec(message);
    if (!found) {
      response = `Sorry, we don't understand please send a number for the question & possible answers or number followed by the letter for your answer.

example
1 for question 1 and it's answers
OR
1a to answer a for question 1`;
    } else {
      const question = found[1];
      const answer = found[2];
      response = `Q: ${question}
A: ${answer}`;
    }
    nexmo.message.sendSms(
      request.query.to,
      request.query.msisdn,
      response,
      () => {}
    );
    reply({});
  }
});

// Start the server
server.start(err => {
  if (err) {
    throw err;
  }
  console.log(`Server running at: ${server.info.uri}`);
});
