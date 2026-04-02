# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This repository is currently empty. Update this file once code is added.

## Code Standards

### Comments
- Every function must have a comment describing its purpose, parameters, and return value.
- Use JSDoc style for JavaScript/TypeScript:
  ```ts
  /**
   * 计算两数之和
   * @param a 第一个加数
   * @param b 第二个加数
   * @returns 两数之和
   */
  function add(a: number, b: number): number { ... }
  ```

### Complexity
- Function cyclomatic complexity must not exceed 15. Break complex logic into smaller, focused helper functions.

### TypeScript Types
- All variables, parameters, and return values must have explicit type annotations — no implicit `any`.
- Every type, interface, and enum should have a comment explaining its purpose and non-obvious fields:
  ```ts
  /** 用户信息 */
  interface User {
    /** 用户唯一标识 */
    id: string;
    /** 显示名称 */
    name: string;
  }
  ```
