import { registerRootComponent } from 'expo';
import Root from './src'; // or wherever your root component is

export default function App() {
  return <Root />;
}

registerRootComponent(App);