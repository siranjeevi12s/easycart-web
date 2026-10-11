import { registerRootComponent } from 'expo';
import App from './App';

// Project-root entry: resolves './App' relative to THIS file, so Metro never
// depends on node_modules/expo living inside apps/customer (npm workspaces
// hoist expo to the repo root, which breaks expo/AppEntry's relative import).
registerRootComponent(App);
