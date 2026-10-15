//#region src/invariant.ts
const PACKAGE_NAME = "dsh-deepseek-web-free";
const name = "dsh-deepseek-web-free-invariant";
const inject = ["invariants"];
const install = () => {};
const apply = (ctx) => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install));
//#endregion
export { apply, inject, name };

//# sourceMappingURL=invariant.js.map