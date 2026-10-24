// Movement API calls. Step 6 only needs createMovement; Step 8 adds history and stock updates.
import { post } from './api.js';

export const createMovement = (movement) => post('/movements', movement);