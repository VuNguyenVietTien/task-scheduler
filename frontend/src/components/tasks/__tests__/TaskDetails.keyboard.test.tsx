import React from 'react';
import {
  render,
  screen,
  userEvent,
  createMockTask,
} from '@/test-utils';
import { TaskDetails } from '../TaskDetails';

describe('TaskDetails - Keyboard Interactions', () => {
  const mockTask = createMockTask({
    id: 'task-1',
    title: 'Test Task',
  });

  const defaultProps = {
    task: mockTask,
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('focus management', () => {
    it('autofocuses close button on mount', () => {
      render(<TaskDetails {...defaultProps} />);
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
    });

    it('restores focus on unmount', () => {
      // Create a button to focus before mounting dialog
      const button = document.createElement('button');
      button.textContent = 'External Button';
      document.body.appendChild(button);
      button.focus();

      const { unmount } = render(<TaskDetails {...defaultProps} />);
      unmount();

      expect(button).toHaveFocus();
      document.body.removeChild(button);
    });

    it('moves focus to confirm button when delete is clicked', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);

      expect(screen.getByRole('button', { name: /confirm/i })).toHaveFocus();
    });
  });

  describe('keyboard shortcuts', () => {
    it('closes on Escape key', async () => {
      render(<TaskDetails {...defaultProps} />);
      await userEvent.keyboard('{Escape}');
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('opens delete confirmation on Ctrl+Delete', async () => {
      render(<TaskDetails {...defaultProps} />);
      await userEvent.keyboard('{Control>}{Delete}{/Control}');
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('closes delete confirmation on Escape', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      // Open delete confirmation
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      // Press Escape
      await userEvent.keyboard('{Escape}');
      
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('confirms deletion on Enter when confirm button is focused', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      // Open delete confirmation
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      // Press Enter on confirm button
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      confirmButton.focus();
      await userEvent.keyboard('{Enter}');
      
      expect(defaultProps.onDelete).toHaveBeenCalledWith(mockTask.id);
    });
  });

  describe('click outside', () => {
    it('closes when clicking outside the dialog', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      // Click the dialog backdrop (parent element)
      const dialog = screen.getByRole('dialog');
      await userEvent.click(dialog);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close when clicking inside the dialog', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      // Click the title (inside the dialog)
      const title = screen.getByText(mockTask.title);
      await userEvent.click(title);
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('does not close delete confirmation when clicking outside', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      // Open delete confirmation
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      // Click the dialog backdrop
      const dialog = screen.getByRole('dialog');
      await userEvent.click(dialog);
      
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  describe('tab navigation', () => {
    it('maintains proper tab order', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      const editButton = screen.getByRole('button', { name: /edit/i });
      const deleteButton = screen.getByRole('button', { name: /delete/i });

      // Start from close button
      expect(closeButton).toHaveFocus();

      // Tab to edit button
      await userEvent.tab();
      expect(editButton).toHaveFocus();

      // Tab to delete button
      await userEvent.tab();
      expect(deleteButton).toHaveFocus();

      // Tab back to close button
      await userEvent.tab();
      expect(closeButton).toHaveFocus();
    });

    it('handles tab order in delete confirmation', async () => {
      render(<TaskDetails {...defaultProps} />);
      
      // Open delete confirmation
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await userEvent.click(deleteButton);
      
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      const cancelButton = screen.getByRole('button', { name: /cancel delete/i });

      // Start from confirm button
      expect(confirmButton).toHaveFocus();

      // Tab to cancel button
      await userEvent.tab();
      expect(cancelButton).toHaveFocus();
    });
  });
});
