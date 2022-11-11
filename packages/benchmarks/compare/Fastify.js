import Fastify from 'fastify';

const schema = {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          hello: {
            type: 'string'
          }
        }
      }
    }
  }
};

const fastify = Fastify();
fastify
  .get('/:say', schema, (req, reply) => {
    reply.send(`Thunderstruck... ${req.params.say}`);
  })
  .listen({ port: 5050 });
