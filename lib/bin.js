#!/usr/bin/env node
import { c as CompatDeepSeekWebClient, f as redactSensitiveText, t as CREDENTIAL_REF_DEFAULT } from "./config-DACadRbL.js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
//#region src/bin.ts
async function main() {
	const [action, flag] = process.argv.slice(2);
	if (action === "login" && flag === "--token-stdin") {
		const rl = createInterface({
			input: stdin,
			output: stdout
		});
		const token = (await rl.question("")).trim();
		rl.close();
		const client = new CompatDeepSeekWebClient();
		try {
			const account = await client.currentUser(token);
			stdout.write(`validated account ${account.accountHash.slice(0, 8)}…\nstore this token in DSH credentials as ${CREDENTIAL_REF_DEFAULT}\n`);
		} finally {
			await client.dispose();
		}
		return;
	}
	if (action === "status" || action === "doctor" || action === "browser" || action === "logout" || action === "login") {
		stdout.write(`Run this command through dsh so credentials and browser profile resolve:\n  dsh plugin --profile web exec dsh-deepseek-web-free ${action ?? "status"}\n`);
		return;
	}
	stdout.write("Usage: dsh-deepseek-web-free <login|logout|status|doctor|browser> [--token-stdin]\n");
}
main().catch((error) => {
	process.stderr.write(`${redactSensitiveText(error instanceof Error ? error.message : String(error))}\n`);
	process.exitCode = 1;
});
//#endregion
export {};

//# sourceMappingURL=bin.js.map