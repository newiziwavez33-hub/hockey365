"""KHL ingestion is unavailable until a verified, licensed source is configured.

Do not regenerate old demo scores, standings, roster or news as if they were
current. The scheduled job may still update official NHL data independently.
"""

import sys


def sync_khl_data(output_data_dir):
    raise RuntimeError('KHL sync disabled: no verified data provider is implemented')


if __name__ == '__main__':
    print('KHL update skipped: no verified data provider is implemented', file=sys.stderr)
