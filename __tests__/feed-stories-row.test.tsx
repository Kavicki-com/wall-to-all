import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FeedStoriesRow } from '../components/feed/FeedStoriesRow';
import type { FeedAuthor, FeedStoryGroup } from '../lib/services/feedTypes';

function author(businessId: number, name: string, logoUrl: string | null = null): FeedAuthor {
  return { businessId, name, handle: `@${businessId}`, logoUrl };
}

function group(a: FeedAuthor): FeedStoryGroup {
  return { author: a, posts: [] };
}

const zara = group(author(102, 'Zara Moda', 'https://example.com/zara.png'));
const bella = group(author(103, 'Bella Boutique'));
const me = author(900, 'Minha Loja');

describe('FeedStoriesRow', () => {
  it('um item por grupo, com nome e rótulo de acessibilidade', () => {
    const onPressGroup = jest.fn();
    const { getByText, getByLabelText } = render(
      <FeedStoriesRow groups={[zara, bella]} onPressGroup={onPressGroup} />,
    );
    expect(getByText('Zara Moda')).toBeTruthy();
    expect(getByText('Bella Boutique')).toBeTruthy();
    fireEvent.press(getByLabelText('Stories de Bella Boutique'));
    expect(onPressGroup).toHaveBeenCalledWith(bella);
  });

  it('logo nulo mostra iniciais', () => {
    const { getByText } = render(<FeedStoriesRow groups={[bella]} onPressGroup={jest.fn()} />);
    expect(getByText('BB')).toBeTruthy();
  });

  it('sem ownStory não há "Seu story"', () => {
    const { queryByText } = render(<FeedStoriesRow groups={[zara]} onPressGroup={jest.fn()} />);
    expect(queryByText('Seu story')).toBeNull();
  });

  it('"Seu story" vem primeiro, com badge "+", e chama onPressOwn', () => {
    const onPressOwn = jest.fn();
    const onPressGroup = jest.fn();
    const { getAllByRole, getByText, getByTestId } = render(
      <FeedStoriesRow
        groups={[zara]}
        ownStory={{ author: me, active: false }}
        onPressGroup={onPressGroup}
        onPressOwn={onPressOwn}
      />,
    );
    const buttons = getAllByRole('button');
    expect(buttons[0].props.accessibilityLabel).toBe('Seu story');
    expect(getByText('+')).toBeTruthy();
    expect(getByTestId('own-story-ring')).toBeTruthy();
    fireEvent.press(buttons[0]);
    expect(onPressOwn).toHaveBeenCalledTimes(1);
    expect(onPressGroup).not.toHaveBeenCalled();
  });

  it('ownStory ativo troca o testID do anel', () => {
    const { getByTestId, queryByTestId } = render(
      <FeedStoriesRow
        groups={[]}
        ownStory={{ author: me, active: true }}
        onPressGroup={jest.fn()}
        onPressOwn={jest.fn()}
      />,
    );
    expect(getByTestId('own-story-ring-active')).toBeTruthy();
    expect(queryByTestId('own-story-ring')).toBeNull();
  });

  it('sem grupos e sem ownStory não renderiza nada', () => {
    const { toJSON } = render(<FeedStoriesRow groups={[]} onPressGroup={jest.fn()} />);
    expect(toJSON()).toBeNull();
  });
});
