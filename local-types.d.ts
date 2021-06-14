declare module 'parse-static-imports' {
  export interface Import {
    moduleName: string;
    starImport: string;
    namedImports: { name: string; alias: string }[];
    defaultImport: string;
    sideEffectOnly: boolean;
  }

  export default function parseStaticImports(code: string): Import[];
}

declare module '@babel/plugin-transform-template-literals' {}
declare module '@babel/plugin-transform-modules-amd' {}
declare module '@babel/plugin-transform-unicode-escapes' {}

declare module 'common-tags' {
  export function stripIndent(s: TemplateStringsArray): string;
}
