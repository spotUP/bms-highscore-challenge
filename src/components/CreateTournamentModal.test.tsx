import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTournamentModal } from './CreateTournamentModal';

const createTournament = vi.fn();
const toast = vi.fn();

vi.mock('@/contexts/TournamentContext', () => ({
  useTournament: () => ({ createTournament }),
}));

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast }),
}));

// Result the next awaited query resolves to; tests set it per case.
const { queryResult, inserts } = vi.hoisted(() => ({
  queryResult: { current: { data: null as any, error: null as any, count: null as number | null } },
  inserts: [] as Array<{ table: string; rows: any }>,
}));

vi.mock('@/lib/api-client', () => {
  // Every builder method chains; awaiting anywhere yields queryResult. Inserts
  // are recorded so tests can assert what was written.
  const makeBuilder = (table: string): any => {
    const builder: any = new Proxy(
      {
        then: (resolve: (value: any) => unknown) => Promise.resolve(queryResult.current).then(resolve),
      },
      {
        get(target: any, prop: string) {
          if (prop in target) return target[prop];
          return (...args: any[]) => {
            if (prop === 'insert') inserts.push({ table, rows: args[0] });
            return builder;
          };
        },
      }
    );
    return builder;
  };
  return { api: { from: (table: string) => makeBuilder(table), rpc: () => Promise.resolve(queryResult.current) } };
});

vi.mock('@/services/clearLogoService', () => ({
  clearLogoService: {
    getClearLogosForGames: vi.fn().mockResolvedValue({}),
    searchClearLogos: vi.fn().mockResolvedValue([]),
  },
}));

const startInput = () => screen.getByPlaceholderText('Select start date and time') as HTMLInputElement;
const endInput = () => screen.getByPlaceholderText('Select end date and time') as HTMLInputElement;

// What the field must show for a given instant, in the browser's own timezone.
const formatLocal = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours24 = date.getHours();
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${hours12}:${pad(date.getMinutes())} ${suffix}`;
};

const renderModal = () => render(<CreateTournamentModal isOpen onClose={vi.fn()} />);

const openStartPicker = async () => {
  fireEvent.focus(startInput());
  fireEvent.click(startInput());
  return waitFor(() => {
    const calendar = document.querySelector('.react-datepicker');
    if (!calendar) throw new Error('date picker did not open');
    return calendar;
  });
};

describe('CreateTournamentModal date and time fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTournament.mockResolvedValue(null);
    queryResult.current = { data: null, error: null, count: null };
    inserts.length = 0;
  });

  it('prefills both fields with local time, not UTC', () => {
    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(now.getMonth() + 1);

    renderModal();

    expect(startInput().value).toBe(formatLocal(now));
    expect(endInput().value).toBe(formatLocal(oneMonthLater));
  });

  it('shows the picked day in the field', async () => {
    renderModal();
    const before = startInput().value;

    const calendar = await openStartPicker();
    const day25 = calendar.querySelector(
      '.react-datepicker__day--025:not(.react-datepicker__day--outside-month)'
    );
    expect(day25).toBeTruthy();
    fireEvent.click(day25!);

    const expectedDay = new Date();
    expectedDay.setDate(25);
    await waitFor(() => expect(startInput().value).toBe(formatLocal(expectedDay)));
    expect(startInput().value).not.toBe(before === formatLocal(expectedDay) ? 'never' : before);
  });

  it('shows the picked time in the field', async () => {
    renderModal();

    const calendar = await openStartPicker();
    const eightPm = Array.from(
      calendar.querySelectorAll('li.react-datepicker__time-list-item')
    ).find(item => item.textContent === '8:00 PM');
    expect(eightPm).toBeTruthy();
    fireEvent.click(eightPm!);

    await waitFor(() => expect(startInput().value).toMatch(/ 8:00 PM$/));
  });

  it('submits the picked local time as the matching UTC instant', async () => {
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('My Awesome Tournament'), {
      target: { value: 'Summer Cup' },
    });

    const calendar = await openStartPicker();
    const eightPm = Array.from(
      calendar.querySelectorAll('li.react-datepicker__time-list-item')
    ).find(item => item.textContent === '8:00 PM');
    fireEvent.click(eightPm!);
    await waitFor(() => expect(startInput().value).toMatch(/ 8:00 PM$/));

    fireEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));

    await waitFor(() => expect(createTournament).toHaveBeenCalled());

    const expected = new Date();
    expected.setHours(20, 0, 0, 0);
    expect(createTournament.mock.calls[0][0].start_time).toBe(expected.toISOString());
  });
});

describe('CreateTournamentModal address availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createTournament.mockResolvedValue(null);
  });

  it('blocks submission when an address typed by hand is already taken', async () => {
    // A row came back, so the address exists.
    queryResult.current = { data: { id: 'existing' }, error: null, count: 1 };
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('My Awesome Tournament'), {
      target: { value: 'Summer Cup' },
    });
    // Editing the address means the caller chose it; it is checked, not replaced.
    fireEvent.change(screen.getByLabelText('Tournament Address'), {
      target: { value: 'test' },
    });

    expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Tournament' })).toBeDisabled();
  });

  it('allows submission when no row matches the address', async () => {
    queryResult.current = { data: null, error: null, count: null };
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('My Awesome Tournament'), {
      target: { value: 'a-free-address' },
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create Tournament' })).toBeEnabled()
    );
    expect(screen.queryByText(/already taken/i)).not.toBeInTheDocument();
  });
});

describe('CreateTournamentModal games it was opened with', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserts.length = 0;
    queryResult.current = { data: null, error: null, count: null };
  });

  it('adds the games handed to it to the tournament it creates', async () => {
    createTournament.mockResolvedValue({ id: 'tournament-1', name: 'Suggested Arcade Night' });

    render(
      <CreateTournamentModal
        isOpen
        onClose={vi.fn()}
        initialGames={[
          { name: 'Galaga', logo_url: 'https://example.test/galaga.png' },
          { name: 'Donkey Kong' },
        ]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('My Awesome Tournament'), {
      target: { value: 'Suggested Arcade Night' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));

    await waitFor(() => expect(inserts.filter(i => i.table === 'games')).toHaveLength(2));
    expect(inserts.map(i => i.rows.name)).toEqual(['Galaga', 'Donkey Kong']);
    expect(inserts.every(i => i.rows.tournament_id === 'tournament-1')).toBe(true);
    expect(inserts[0].rows.logo_url).toBe('https://example.test/galaga.png');
  });
});

describe('CreateTournamentModal duplicate names', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inserts.length = 0;
  });

  it('moves to the next free address when another tournament has the name', async () => {
    // The address list query answers with the address someone else already owns.
    queryResult.current = { data: [{ slug: 'test' }], error: null, count: 1 };
    renderModal();

    fireEvent.change(screen.getByPlaceholderText('My Awesome Tournament'), {
      target: { value: 'test' },
    });

    await waitFor(() =>
      expect((screen.getByLabelText('Tournament Address') as HTMLInputElement).value).toBe('test-2')
    );
    expect(screen.getByText(/is taken, so this tournament will use/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Tournament' })).toBeEnabled();
  });
});
