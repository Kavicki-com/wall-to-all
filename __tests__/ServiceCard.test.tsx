import React from 'react';
import { render } from '@testing-library/react-native';
import ServiceCard from '../components/ServiceCard';

describe('ServiceCard', () => {
  it('renderiza com imagem e ratings fornecidos', () => {
    const { getByText } = render(
      <ServiceCard
        name="Corte"
        price={50}
        photos={['https://example.com/photo.jpg']}
        rating={4.5}
        reviewCount={12}
      />
    );

    expect(getByText('Corte')).toBeTruthy();
    expect(getByText('R$ 50,00')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('(12)')).toBeTruthy();
  });

  it('renderiza placeholders quando não há imagem ou avaliações', () => {
    const { getByText } = render(<ServiceCard name="Massagem" price={80} photos={null} />);

    expect(getByText('Massagem')).toBeTruthy();
    expect(getByText('R$ 80,00')).toBeTruthy();
    expect(getByText('4.5')).toBeTruthy();
    expect(getByText('(25)')).toBeTruthy();
  });
});

