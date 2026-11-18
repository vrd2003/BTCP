import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./FlightRouteMap', () => () => null);
jest.mock('socket.io-client', () => ({
  io: () => ({ on: jest.fn().mockReturnThis(), disconnect: jest.fn() })
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  sessionStorage.clear();
  global.fetch = jest.fn(() => new Promise(() => {}));
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('opens account authentication instead of showing hard-coded dashboard data', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /your flight delayed/i })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /explore flightsure/i })[0]);
  expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  expect(screen.queryByText(/good morning, sam/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/demo data/i)).not.toBeInTheDocument();
});

test('uses the authentication API and renders empty account state from the backend', async () => {
  global.fetch.mockImplementation(async url => {
    const path = new URL(url).pathname;
    const payload = path.endsWith('/auth/register')
      ? { user: { name: 'Jordan Lee', email: 'jordan@example.com', role: 'Passenger' }, accessToken: 'test-token' }
      : path.endsWith('/auth/me')
        ? { user: { name: 'Jordan Lee', email: 'jordan@example.com', role: 'Passenger' } }
        : { metrics: { activePolicies: 0, monitoredFlights: 0, confirmedCompensation: [], pendingVerification: 0 }, policies: [], flights: [], recentActivity: [], delayHistory: [] };
    return { ok: true, status: 200, json: async () => ({ success: true, data: payload }) };
  });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /open app/i }));
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  await screen.findByLabelText(/your name/i);
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jordan Lee' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jordan@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'a-secure-test-password' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  expect(await screen.findByText(/no insured flights yet/i)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/auth/register'),
    expect.objectContaining({ method: 'POST' })
  );
});

test('continues from provider flight search to a selected-flight prediction request', async () => {
  const flight = {
    _id: '0123456789abcdef01234567',
    airline: 'Example Air',
    flightNumber: 'EA123',
    origin: 'JFK',
    destination: 'LHR',
    scheduledDeparture: '2026-12-01T10:00:00.000Z',
    scheduledArrival: '2026-12-01T18:00:00.000Z',
    lastFetchedAt: '2026-11-17T10:00:00.000Z'
  };
  const user = { name: 'Jordan Lee', email: 'jordan@example.com', role: 'Passenger' };
  global.fetch.mockImplementation(async url => {
    const path = new URL(url).pathname;
    const payload = path.endsWith('/auth/register')
      ? { user, accessToken: 'test-token' }
      : path.endsWith('/auth/me')
        ? { user }
        : path.endsWith('/flights/search') || path.endsWith('/flights/recent')
          ? { flights: [flight] }
          : { metrics: {}, policies: [], flights: [], recentActivity: [], delayHistory: [], predictions: [] };
    return { ok: true, status: 200, json: async () => ({ success: true, data: payload }) };
  });

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /open app/i }));
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  fireEvent.change(await screen.findByLabelText(/your name/i), { target: { value: user.name } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'a-secure-test-password' } });
  fireEvent.submit(screen.getByLabelText(/your name/i).closest('form'));

  fireEvent.click(await screen.findByTitle('Find flights', {}, { timeout: 15000 }));
  await screen.findByRole('heading', { name: 'Find your flight.' });
  fireEvent.click(screen.getByRole('button', { name: /flight number/i }));
  fireEvent.change(screen.getByLabelText(/flight number/i), { target: { value: 'BA117' } });
  fireEvent.click(screen.getByRole('button', { name: /search flights/i }));

  fireEvent.click(await screen.findByRole('button', { name: /assess delay risk/i }));
  expect(await screen.findByRole('heading', { name: /a signal, not a promise/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'EA123' })).toBeInTheDocument();
  expect(await screen.findByRole('option', { name: /EA123 · JFK → LHR/i })).toBeInTheDocument();
  expect(global.fetch.mock.calls.some(([url]) => new URL(url).searchParams.get('flightNumber') === 'BA117')).toBe(true);
}, 30000);
