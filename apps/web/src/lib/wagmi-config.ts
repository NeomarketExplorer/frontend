import { createConfig, http } from 'wagmi';
import { polygon } from 'wagmi/chains';

export const wagmiConfig = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http('https://polygon-rpc.com'),
  },
  ssr: true,
});
