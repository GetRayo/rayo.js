import Fastify from 'fastify';
import { ready, versionOf } from '../runtime.js';

const fastify = Fastify();
fastify.get('/:say', (req, reply) => reply.raw.end(`Thunderstruck... ${req.params.say}`));
await fastify.listen({ port: 0, host: '127.0.0.1' });
ready(fastify.server, { fastify: versionOf('fastify') });
