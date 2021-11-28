# Verify ENS constitution ratification votes
This repository contains copies of all the votes on the ENS constitution (84,350 in total) and a script to verify and count them.

## Installation
```
npm install
```

## Usage
To do a basic verification, not including contract signatures:

```
npm run verify
```

You should get this exact result:
```
84350 votes (16,102,807 ENS): 1. 93.58% 2. 93.44% 3. 92.45% 4. 93.27% Unknown: 0.22%
```

Verifying contract signatures (about 0.22% of total votes) requires access to an archive node. Specify its endpoint URL with `WEB3_PROVIDER_URL`:
```
WEB3_PROVIDER_URL=http://localhost:8545/ npm run verify
```

You should get this exact result:
```
84350 votes (16,102,807 ENS): 1. 93.79% 2. 93.66% 3. 92.66% 4. 93.49% Unknown: 0.00%
```

Note that one contract signature fails validation, for currently unknown reasons:
```
Error verifying QmR7D9L39PKq8eyTzWupiJqCKQPGCWe1GcFMdLSAKewNNe: Error: Verifying at block 13602579: Error: call revert exception (method="isValidSignature(bytes32,bytes)", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.5.0)
```

