import { render, screen } from '@testing-library/react';
import FlightRouteMap, { createGreatCirclePath } from './FlightRouteMap';

jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children, role, 'aria-label': ariaLabel, style }) => React.createElement('div', {
      role,
      'aria-label': ariaLabel,
      style
    }, children),
    Marker: ({ children }) => React.createElement('div', null, children),
    Polyline: () => null,
    TileLayer: ({ attribution, url }) => React.createElement('div', {
      'data-testid': 'map-tiles',
      'data-url': url,
      dangerouslySetInnerHTML: { __html: attribution }
    }),
    Tooltip: ({ children }) => React.createElement('span', null, children),
    useMap: () => ({ fitBounds: jest.fn() })
  };
});

jest.mock('leaflet', () => ({
  divIcon: options => options
}));

test('renders OpenStreetMap tiles and a route for known airport coordinates without an API key', () => {
  render(<FlightRouteMap origin="IND" destination="LHR" />);

  expect(screen.getByRole('region', { name: 'Map route from IND to LHR' })).toBeInTheDocument();
  expect(screen.getByTestId('map-tiles')).toHaveAttribute('data-url', 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  expect(screen.getByTestId('map-tiles')).toHaveTextContent(/OpenStreetMap/);
  expect(screen.getByText('IND')).toBeInTheDocument();
  expect(screen.getByText('LHR')).toBeInTheDocument();
  expect(screen.getByText(/live aircraft position unavailable/i)).toBeInTheDocument();
});

test('rejects incomplete airport codes', () => {
  render(<FlightRouteMap origin="J" destination="LHR" />);

  expect(screen.getByRole('status')).toHaveTextContent(/valid three-letter IATA airport codes/i);
});

test('reports when the bundled airport directory has no matching coordinates', () => {
  render(<FlightRouteMap origin="ZZZ" destination="LHR" />);

  expect(screen.getByRole('status')).toHaveTextContent(/coordinates are unavailable for ZZZ/i);
});

test('draws a curved great-circle route between airports', () => {
  const route = createGreatCirclePath([40.64, -73.78], [51.47, -0.45]);

  expect(route).toHaveLength(49);
  expect(route[0]).toEqual([40.64, -73.78]);
  expect(route[route.length - 1]).toEqual([51.47, -0.45]);
  expect(route[24][0]).toBeGreaterThan(51.47);
});
