// Compatibility entry point: use the same ranking scope and conservative classification as CI.
import { main } from './updateFrozenUsers.js';

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
