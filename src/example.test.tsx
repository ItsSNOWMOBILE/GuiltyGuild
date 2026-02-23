import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

describe('Frontend Test Setup Verification', () => {
    it('should run tests in the Vite environment', () => {
        expect(true).toBe(true);
    });

    it('should correctly render React components via Testing Library', () => {
        render(<div>Guild Trial Component</div>);
        expect(screen.getByText('Guild Trial Component')).toBeInTheDocument();
    });
});
