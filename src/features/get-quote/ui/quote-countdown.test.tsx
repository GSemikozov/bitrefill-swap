import { QUOTE_TTL_MS } from '@shared/config';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuoteCountdown } from './quote-countdown';

const TTL_SECONDS = QUOTE_TTL_MS / 1_000;

describe('QuoteCountdown', () => {
  it('renders nothing until a quote has loaded', () => {
    const { container } = render(<QuoteCountdown updatedAt={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('caps the countdown at the TTL even when updatedAt is slightly ahead of now', () => {
    // Right after a refetch, dataUpdatedAt can sit a few ms ahead of the last
    // `now` tick — without the cap this rounds up to TTL+1 (e.g. 31s).
    render(<QuoteCountdown updatedAt={Date.now() + 500} />);
    expect(screen.getByText(`Quote refreshes in ${TTL_SECONDS}s`)).toBeInTheDocument();
    expect(screen.queryByText(`Quote refreshes in ${TTL_SECONDS + 1}s`)).not.toBeInTheDocument();
  });

  it('shows the refreshing state once the quote is stale', () => {
    render(<QuoteCountdown updatedAt={Date.now() - QUOTE_TTL_MS - 1_000} />);
    expect(screen.getByText('Refreshing quote…')).toBeInTheDocument();
  });
});
