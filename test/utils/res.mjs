import { ServerResponse } from 'http';

const response = new ServerResponse('rayo');
const res = {
  ...response,
  setHeader: () => {},
  writeHead: () => {},
  write: () => {},
  end: () => {}
};

export default res;
