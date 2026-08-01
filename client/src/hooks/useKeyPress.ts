import { useEffect } from 'react';

export function useKeyPress(
  targetKey: string | null,
  action: () => void,
  disabled: boolean = false
) {
  useEffect(() => {
    if (!targetKey || disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keypresses when typing in inputs or textareas
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // Match target key (case-insensitive)
      if (event.key.toLowerCase() === targetKey.toLowerCase()) {
        event.preventDefault();
        action();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [targetKey, action, disabled]);
}
