import Dotenv from 'dotenv';
import Hapi from 'hapi';
import Nexmo from 'nexmo';
import Knex from 'knex';

// Load any local ENV
Dotenv.load({ silent: true });

// Load and config NEXMO
const nexmo = new Nexmo({
  apiKey: process.env.NEXMO_API_KEY,
  apiSecret: process.env.NEXMO_API_SECRET,
  applicationId: process.env.NEXMO_APP_ID,
  privateKey: process.env.NEXMO_APP_ID
});

// Configure the DB
const Database = Knex({
  client: 'pg',
  connection: process.env.DATABASE_URL,
  searchPath: 'knex,public'
});

// Make sure the tables exist
Database.schema
  .createTableIfNotExists('questions', table => {
    table.increments();
    table.text('question');
    table.string('answer_a');
    table.string('answer_b');
    table.string('answer_c');
    table.string('answer_d');
    table.timestamps(true, true);
  })
  .then();
Database.schema
  .createTableIfNotExists('answers', table => {
    table.increments();
    table.bigInteger('number');
    table.integer('question').unsigned();
    table.foreign('question').references('questions.id');
    table.string('answer');
    table.timestamps(true, true);
  })
  .then();

// Setup Hapi
const server = new Hapi.Server();
server.connection({ port: process.env.PORT || 8000, host: '0.0.0.0' });

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
      nexmo.message.sendSms(
        request.query.to,
        request.query.msisdn,
        response,
        () => {}
      );
    } else {
      const questionNumber = found[1];
      const answer = found[2];
      if (answer) {
        Database.insert({
          number: request.query.msisdn,
          question: questionNumber,
          answer: answer
        })
          .into('answers')
          .then(() => {
            response = `Thank you for the answer.`;
          })
          .then(() => {
            nexmo.message.sendSms(
              request.query.to,
              request.query.msisdn,
              response,
              () => {}
            );
          });
      } else {
        Database.select(
          'question',
          'answer_a',
          'answer_b',
          'answer_c',
          'answer_d'
        )
          .from('questions')
          .where({ id: questionNumber })
          .then(data => {
            if (data.lenght) {
              response = `Question:
${data[0].question}

Answers:
A) ${data[0].answer_a}
B) ${data[0].answer_b}
C) ${data[0].answer_c}
D) ${data[0].answer_d}`;
            } else {
              response = `No question ${questionNumber}, try another.`;
            }
          })
          .then(() => {
            nexmo.message.sendSms(
              request.query.to,
              request.query.msisdn,
              response,
              () => {}
            );
          });
      }
    }
    reply({});
  }
});
Database.select('question', 'answer_a', 'answer_b', 'answer_c', 'answer_d')
  .from('questions')
  .where({ id: 1 })
  .then(data => {});
// Start the server
server.start(err => {
  if (err) {
    throw err;
  }
  console.log(`Server running at: ${server.info.uri}`);
});
