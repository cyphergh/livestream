import { jwt } from '@elysiajs/jwt';
import { config } from '../config';

// Applies both JWT instances so handlers can destructure accessJwt/refreshJwt.
export const jwtPlugin = () =>
  jwt({ name: 'accessJwt', secret: config.JWT_ACCESS_SECRET, alg: 'HS256' })
    .use(jwt({ name: 'refreshJwt', secret: config.JWT_REFRESH_SECRET, alg: 'HS256' }));
