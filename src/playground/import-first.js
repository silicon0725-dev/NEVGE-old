import './public-path';
import '../lib/tw-polyfill';
import '../lib/normalize.css';

import migrateLegacyPlaintextCredentials from '../lib/credentials/legacy-credential-migration';

migrateLegacyPlaintextCredentials();
