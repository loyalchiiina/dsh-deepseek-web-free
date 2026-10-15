//#region src/tui.ts
const name = "dsh-deepseek-web-free-tui";
const inject = ["deepSeekWeb"];
function apply(ctx) {
	ctx.provide("deepSeekWebTui", {});
	ctx.inject(["commands"], (injected) => {
		injected.commands.register({
			name: "deepseek-web",
			description: "DeepSeek Web login and diagnostics",
			handler: async (invocation) => {
				const action = (invocation.text ?? "status").trim().split(/\s+/)[0];
				const service = ctx.deepSeekWeb;
				if (action === "login") return {
					kind: "success",
					text: `DeepSeek Web: ${(await service.login({ resetProfile: true })).status}`
				};
				if (action === "logout") {
					await service.logout();
					return {
						kind: "success",
						text: "DeepSeek Web signed out"
					};
				}
				if (action === "doctor") {
					const doctor = await service.doctor();
					return {
						kind: doctor.ok ? "success" : "error",
						text: JSON.stringify(doctor.checks)
					};
				}
				return {
					kind: "success",
					text: `DeepSeek Web: ${(await service.status()).status}`
				};
			}
		});
	});
	ctx.inject(["tuiCommandTrees"], (injected) => {
		injected.tuiCommandTrees.register({
			root: "deepseek-web",
			descriptions: {
				en: "DeepSeek Web",
				zh: "DeepSeek Web"
			},
			children: (path) => {
				if (path.length === 1) return [
					{
						name: "status",
						description: "Show sign-in state"
					},
					{
						name: "login",
						description: "Sign in with DeepSeek"
					},
					{
						name: "logout",
						description: "Sign out"
					},
					{
						name: "doctor",
						description: "Run diagnostics"
					}
				];
				return [];
			}
		});
	});
}
//#endregion
export { apply, inject, name };

//# sourceMappingURL=tui.js.map