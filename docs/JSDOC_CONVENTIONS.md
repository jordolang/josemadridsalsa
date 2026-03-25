# JSDoc Conventions for the Project

This document outlines the standard JSDoc conventions to be followed for documenting code in the project. These standards ensure consistency, readability, and alignment with TypeScript and the project's coding guidelines (e.g., two-space indentation, functional components, and Tailwind-first approach).

## General Rules
- Use JSDoc comments for all public functions, classes, and modules.
- Place JSDoc comments immediately above the element they document.
- Use two-space indentation for all code blocks within comments.
- Include descriptions that are concise, clear, and use imperative mood for actions.
- Always include types for parameters and return values, leveraging TypeScript types where possible.

## Required Tags
- **@description**: Provide a brief overview of the function or module's purpose.
- **@param {type} name - description**: Document each parameter, including its type, name, and a short description. Example:
  ```js
  /**
   * @param {string} userId - The unique ID of the user.
   */
  ```
- **@returns {type} - description**: Describe the return value, including its type and what it represents. If the function returns void, use @returns {void}.
- **@example**: Include code examples for complex functions to illustrate usage.
- **@throws {type} - description**: Document any potential errors or exceptions.

## Examples
### Function Example
```js
/**
 * Calculates the total price with tax.
 * @param {number} subtotal - The base subtotal amount.
 * @param {number} taxRate - The tax rate as a decimal (e.g., 0.08 for 8%).
 * @returns {number} The total price including tax.
 * @example
 * // Returns 108
 * calculateTotalWithTax(100, 0.08);
 */
export function calculateTotalWithTax(subtotal: number, taxRate: number): number {
  return subtotal * (1 + taxRate);
}
```

### Class Example
```js
/**
 * Represents a user loyalty program.
 * @class
 */
export class LoyaltyProgram {
  /**
   * Initializes the loyalty program.
   * @param {string} userId - The user's ID.
   */
  constructor(userId: string) {}

  /**
   * Adds points to the user's account.
   * @param {number} points - The points to add.
   * @returns {void}
   */
  addPoints(points: number): void {
    // Implementation
  }
}
```

These conventions should be applied to all core library modules in /lib/. Verify adherence by running `npm run lint` and `npm run type-check` after implementation.
