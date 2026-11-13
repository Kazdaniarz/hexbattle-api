# Security policy

HexBattle Online is a non-commercial, fan-made project. The data API is public and read-only: it serves game data and images, and it holds no accounts, passwords or personal data. We still want to hear about anything that could harm the people who use it.

## Reporting a vulnerability

Please report security problems **privately** through GitHub: open this repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue, discussion or pull request for a security problem.

A useful report says:

- what is affected – an address under `https://api.hexbattle.online/`, a file or a tool in this repository, or the `@hexbattle/schema` package;
- the steps to reproduce it, with the exact requests or input;
- what an attacker could do with it;
- whether and how you would like to be credited.

## What to expect

- We confirm that we received the report within **7 days**.
- We tell you whether we accept it and, if we do, roughly when a fix will be out.
- When it is fixed, we publish a GitHub security advisory and credit you, unless you prefer not to be named.
- There is no bug bounty: the project has no income.

## Scope

**In scope:**

- the public API at `https://api.hexbattle.online/v1/` – the files, the query service (`/v1/query/…`), its headers and caching;
- the source in this repository – the build and validation tools, the local server (`pnpm serve`), the tests' tooling;
- the npm package `@hexbattle/schema`.

**Out of scope:**

- denial of service and load or volume testing – please do not send large numbers of requests;
- reports that only say a header or a setting is missing, without a way to harm anyone;
- Cloudflare's own services, GitHub and npm themselves;
- social engineering, phishing and physical attacks;
- mistakes in the game data (a wrong value on a tile) – these are ordinary issues, welcome as public issues;
- questions about the game content and its rights – see [`NOTICE.md`](NOTICE.md).

## Testing in good faith

Test only against your own copy (`pnpm serve`) or with a few ordinary requests to the public API. Do not access or change data that is not yours, do not degrade the service for others, and give us a reasonable time to fix a problem before you talk about it publicly. We will not take action against research that follows this policy.

## Supported versions

Only the current state is supported: the live API, the `main` branch of this repository and the latest published version of `@hexbattle/schema`.
