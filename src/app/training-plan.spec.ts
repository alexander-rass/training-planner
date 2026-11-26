import { parseTrainingData } from './training-data';
import {
  formatWhatsAppPlan,
  markdownToWhatsApp,
  StagePlan,
  whatsAppToMarkdown,
} from './training-plan';

const data = parseTrainingData({
  schemaVersion: 1,
  catalog: {
    stages: [
      { id: 'game', label: 'Game', order: 3, defaultDrillCount: 1 },
      { id: 'main', label: 'Main part', order: 2, defaultDrillCount: 1 },
      { id: 'warmup', label: 'Warm-up', order: 1, defaultDrillCount: 1 },
    ],
    labels: [{ id: 'passing', label: 'Passing' }],
    mainFilterLabelIds: ['passing'],
    modifications: [
      {
        id: 'player-selection',
        label: 'Player selection',
        type: 'single-select',
        options: [{ id: 'index', label: 'Called by number/index' }],
      },
    ],
  },
  drills: [
    {
      id: 'diamond',
      title: 'Passing Diamond',
      availableStageIds: ['warmup', 'main'],
      labelIds: ['passing'],
      descriptionMarkdown: 'Players form a diamond (**10m x 10m**).\n- Pass to _the back foot_.',
      coachingPoints: ['Keep **moving**.'],
      modificationIds: ['player-selection'],
    },
  ],
});

describe('formatWhatsAppPlan', () => {
  it('orders populated stages and includes drill descriptions and selected options', () => {
    const plans: StagePlan[] = [
      {
        stageId: 'main',
        slots: [{ drillId: 'diamond', modificationSelections: {} }],
      },
      {
        stageId: 'warmup',
        slots: [
          {
            drillId: 'diamond',
            modificationSelections: { 'player-selection': 'index' },
          },
        ],
      },
      { stageId: 'game', slots: [{ drillId: null, modificationSelections: {} }] },
    ];

    expect(formatWhatsAppPlan(data, plans, 'Coaching points')).toBe(
      [
        '*Warm-up*',
        '- *Passing Diamond*',
        '  Players form a diamond (*10m x 10m*).',
        '  - Pass to _the back foot_.',
        '  *Coaching points:*',
        '  - Keep *moving*.',
        '  - *Player selection:* Called by number/index',
        '',
        '*Main part*',
        '- *Passing Diamond*',
        '  Players form a diamond (*10m x 10m*).',
        '  - Pass to _the back foot_.',
        '  *Coaching points:*',
        '  - Keep *moving*.',
        '',
        '*Game*',
      ].join('\n'),
    );
  });

  it('includes every stage when no drills are selected', () => {
    const plans: StagePlan[] = [
      { stageId: 'warmup', slots: [{ drillId: null, modificationSelections: {} }] },
      { stageId: 'main', slots: [{ drillId: null, modificationSelections: {} }] },
    ];

    expect(formatWhatsAppPlan(data, plans, 'Coaching points')).toBe(
      '*Warm-up*\n\n*Main part*\n\n*Game*',
    );
  });
});

describe('markdownToWhatsApp', () => {
  it('converts common Markdown emphasis, headings, lists, and links', () => {
    expect(
      markdownToWhatsApp(
        '# Coaching points\nOpen **your body**, *check shoulders*, and ~~stop~~.\n1. Receive\n[Passing](https://example.test)',
      ),
    ).toBe(
      '*Coaching points*\nOpen *your body*, _check shoulders_, and ~stop~.\n1. Receive\nPassing (https://example.test)',
    );
  });

  it('omits remote image URLs from the copied WhatsApp text', () => {
    expect(markdownToWhatsApp('![training diagram](https://tracker.example/pixel.png)')).toBe(
      'training diagram',
    );
  });
});

describe('whatsAppToMarkdown', () => {
  it('converts WhatsApp formatting markers for a formatted in-app preview', () => {
    expect(
      whatsAppToMarkdown(
        '*Warm-up*\n- *Passing Diamond*\n  Players **open body**.\n  - *Player selection:* Stand in line',
      ),
    ).toBe(
      '## Warm-up\n- **Passing Diamond**\n  Players **open body**.\n  - **Player selection:** Stand in line',
    );
  });
});
