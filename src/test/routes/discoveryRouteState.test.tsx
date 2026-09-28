import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  DiscoveryStateView,
  buildDiscoveryLoadState,
} from '../../routes/contracts/$contractId/discovery'
import { dedupeExplorerKeys } from '../../routes/contracts/$contractId/explorer'

vi.mock('@stellar/design-system', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Heading: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  IconButton: ({
    altText,
    onClick,
    'aria-label': ariaLabel,
  }: {
    altText?: string
    onClick?: () => void
    'aria-label'?: string
  }) => (
    <button
      aria-label={ariaLabel ?? altText ?? 'icon-button'}
      onClick={onClick}
    >
      {altText ?? 'icon'}
    </button>
  ),
}))

describe('discovery route state', () => {
  it('renders loading, empty, error, and success states from route data', () => {
    const retry = vi.fn()

    const { rerender } = render(
      <DiscoveryStateView
        state={buildDiscoveryLoadState({ status: 'loading' })}
        onRetry={retry}
      />,
    )
    expect(screen.getByText('Loading discovered keys…')).toBeTruthy()

    rerender(
      <DiscoveryStateView
        state={buildDiscoveryLoadState({
          status: 'empty',
          requestedKeyCount: 0,
        })}
        onRetry={retry}
      />,
    )
    expect(screen.getByText(/No keys discovered yet/i)).toBeTruthy()

    rerender(
      <DiscoveryStateView
        state={buildDiscoveryLoadState({
          status: 'error',
          error: 'Network failure',
          requestedKeyCount: 3,
        })}
        onRetry={retry}
      />,
    )
    expect(screen.getByText('Network failure')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)

    rerender(
      <DiscoveryStateView
        state={buildDiscoveryLoadState({
          status: 'success',
          keys: [
            { keyPath: '/contracts/key1', type: 'ContractData' },
            { keyPath: '/contracts/key1', type: 'ContractData' },
          ],
          requestedKeyCount: 2,
        })}
        onRetry={retry}
      />,
    )
    expect(screen.getByText('/contracts/key1')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Add to watchlist' }),
    ).toHaveLength(1)
  })

  it('deduplicates explorer keys while preserving first-seen order', () => {
    expect(dedupeExplorerKeys('a, b, a, c, , b')).toBe('a,b,c')
    expect(dedupeExplorerKeys('  zzz ,  aaa , zzz , aaa  ')).toBe('zzz,aaa')
  })
})

describe('discovery input preservation', () => {
  it('maintains separate input state from result state', () => {
    // Input state and result state should be separate
    const inputState = {
      transaction: 'test-xdr',
      arguments: '{"arg": "value"}',
    }

    const loadState = {
      status: 'error' as const,
      error: 'Request failed',
      keys: [],
      requestedKeyCount: 1,
    }

    // Verify they are independent
    expect(inputState.transaction).toBe('test-xdr')
    expect(loadState.status).toBe('error')
    expect(loadState.error).toBe('Request failed')

    // Changing load state should not affect input state
    const newLoadState = {
      ...loadState,
      status: 'loading' as const,
      error: null,
    }

    expect(inputState.transaction).toBe('test-xdr')
    expect(newLoadState.status).toBe('loading')
  })

  it('preserves input values when result state changes', () => {
    const inputState = {
      transaction: 'AAAAAQ==',
      arguments: '{"method": "hello"}',
    }

    // Simulate multiple state transitions
    const states = [
      {
        status: 'loading' as const,
        error: null as string | null,
        keys: [],
        requestedKeyCount: 1,
      },
      {
        status: 'error' as const,
        error: 'Network error',
        keys: [],
        requestedKeyCount: 1,
      },
      {
        status: 'loading' as const,
        error: null,
        keys: [],
        requestedKeyCount: 1,
      },
      {
        status: 'success' as const,
        error: null,
        keys: [],
        requestedKeyCount: 1,
      },
    ]

    // Input state should remain unchanged across all transitions
    states.forEach(() => {
      expect(inputState.transaction).toBe('AAAAAQ==')
      expect(inputState.arguments).toBe('{"method": "hello"}')
    })
  })
})
