// TEST ONLY: no actual Google identity or Airtable data. Never deploy this entrypoint.
import {createServer} from '../server.mjs';
import {fixtureConfig,fixtureClient,fixtureVerify,fixtureNotices} from './fixtures.mjs';
const port=Number(process.env.PORT||8125),origin=`http://127.0.0.1:${port}`;
createServer({config:fixtureConfig(origin),client:fixtureClient(),verify:fixtureVerify,notices:fixtureNotices()}).listen(port,'127.0.0.1');
