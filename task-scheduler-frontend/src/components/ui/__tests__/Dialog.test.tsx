import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from '../Dialog';

describe('Dialog Component', () => {
  const mockOnClose = jest.fn();
  const mockTitle = 'Test Dialog';
  const mockContent = 'Test content';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dialog when open is true', () => {
    render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(mockTitle)).toBeInTheDocument();
    expect(screen.getByText(mockContent)).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(
      <Dialog open={false} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(mockTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(mockContent)).not.toBeInTheDocument();
  });

  it('calls onClose when clicking outside the dialog', async () => {
    render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    // Click the backdrop/overlay
    const backdrop = screen.getByTestId('dialog-backdrop');
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when pressing Escape key', async () => {
    render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    // Press Escape key
    await userEvent.keyboard('{Escape}');

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('maintains focus within the dialog', () => {
    render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <button>First Button</button>
        <button>Second Button</button>
        <button>Third Button</button>
      </Dialog>
    );

    const buttons = screen.getAllByRole('button');
    
    // Initially, the first focusable element should be focused
    expect(buttons[0]).toHaveFocus();

    // Tab through all buttons
    userEvent.tab();
    expect(buttons[1]).toHaveFocus();
    
    userEvent.tab();
    expect(buttons[2]).toHaveFocus();
    
    // Tab again should cycle back to first button
    userEvent.tab();
    expect(buttons[0]).toHaveFocus();
  });

  it('renders with the correct accessibility attributes', () => {
    render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    
    const title = screen.getByText(mockTitle);
    expect(title).toHaveAttribute('id', dialog.getAttribute('aria-labelledby'));
  });

  it('prevents scroll on body when dialog is open', () => {
    const { unmount } = render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    expect(document.body).toHaveStyle({ overflow: 'hidden' });

    unmount();

    expect(document.body).not.toHaveStyle({ overflow: 'hidden' });
  });

  it('supports custom class names', () => {
    render(
      <Dialog 
        open={true} 
        onClose={mockOnClose} 
        title={mockTitle}
        className="custom-dialog"
      >
        <p>{mockContent}</p>
      </Dialog>
    );

    expect(screen.getByRole('dialog')).toHaveClass('custom-dialog');
  });

  it('renders dialog panel with transition classes', () => {
    render(
      <Dialog open={true} onClose={mockOnClose} title={mockTitle}>
        <p>{mockContent}</p>
      </Dialog>
    );

    const panel = screen.getByTestId('dialog-panel');
    expect(panel).toHaveClass('transform', 'transition-all');
  });
});
