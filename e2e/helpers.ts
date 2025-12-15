import { waitFor } from 'detox';

/**
 * Helper function to check if an element exists and perform an action
 * Replaces the non-existent .exists() method
 */
export async function ifElementExists(
  element: any,
  action: () => Promise<void>,
  timeout: number = 2000
): Promise<void> {
  try {
    await waitFor(element).toBeVisible().withTimeout(timeout);
    await action();
  } catch {
    // Element not found, skip action
  }
}

