#!/usr/bin/env python3

"""
COVID-19 global data processor.

Fetches data from JHU CSSE (https://github.com/CSSEGISandData/COVID-19/)
and converts them to JSON files suitable for further processing.

Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
"""

import os
import sys
import csv
import json
import math
import numpy as np
import pandas as pd
from functools import partial
from datetime import timedelta, datetime
from scipy import optimize, integrate

verbosity = 1
start_date = '1/22/20'
first_day = datetime.strptime(start_date, '%m/%d/%y')

path_timeseries = os.path.join('COVID-19', 'csse_covid_19_data', 'csse_covid_19_time_series')
dst_path = os.path.join('dist', 'data')
src_path = os.path.join('src', 'data')
tmp_path = os.path.join('tmp', 'data')
population_filename = os.path.join(src_path, 'world-data.csv')
json_file_template = os.path.join(dst_path, '{country:s}.json')
path_latest = os.path.join('COVID-19-web-data', 'data')
prediction_days = 180
excluded_from_prediction = ['Diamond Princess', 'MS Zaandam']


def is_float(value):
  try:
    if math.isnan(float(value)):
      return False
    return True
  except ValueError:
    return False


def load_world_data(result):
  with open(population_filename, 'r') as f:
    reader = csv.reader(f, delimiter='\t', quotechar='"')
    reader.__next__()  # skip header
    for row in reader:
      result['countries'][row[0]] = {
        'population': int(row[1]),
        'flag': row[2],
      }


def load_ecdc_diff_data(result, dates):
  country_mapping = {
    'Brunei_Darussalam': 'Brunei',
    'United_States_of_America': 'US',
    'United_Republic_of_Tanzania': 'Tanzania',
    'Taiwan': 'Taiwan*',
    'Timor_Leste': 'Timor-Leste',
    'Palestine': 'West Bank and Gaza',
    'South_Korea': 'Korea, South',
    'Guinea_Bissau': 'Guinea-Bissau',
    'Congo': 'Congo (Kinshasa)',
    'Myanmar': 'Burma',
    'Cote_dIvoire': 'Cote d\'Ivoire',
    'Cape_Verde': 'Cabo Verde',
  }
  latest_day = dates[-1]
  dt = latest_day - first_day
  if verbosity > 0:
    print('Reading ECDC daily diff data ...')
  diff_data = pd.read_csv('https://opendata.ecdc.europa.eu/covid19/casedistribution/csv')
  diff_data.drop(['day', 'month', 'year', 'geoId', 'countryterritoryCode', 'popData2018'], axis=1, inplace=True)
  diff_data.to_csv(os.path.join(src_path, 'ecdc-casedistribution.csv'), index=False)
  if verbosity > 0:
    print('Processing ECDC daily diff data ...')
  all_dt = dict(zip(range(dt.days+1), [{ 'cases': None, 'deaths': None }] * (dt.days+1)))
  for country in diff_data.countriesAndTerritories.unique():
    mapped_country = country_mapping[country] if country in country_mapping else country
    mapped_country = mapped_country.replace('_', ' ')
    if verbosity > 0:
      print(' - {}'.format(mapped_country), end='')
      sys.stdout.write("\033[K\r")
      sys.stdout.flush()
    data = diff_data[diff_data['countriesAndTerritories'] == country]
    data.insert(2, 'dt', data['dateRep'].apply(lambda date: (datetime.strptime(date, '%d/%m/%Y') - first_day).days))
    data = data[data['dt'] >= 0]
    deaths = data['deaths'].to_list()
    cases = data['cases'].to_list()
    actual = dict(zip(data['dt'].to_list(), [{ 'deaths': deaths[i], 'cases': cases[i] } for i in range(data['dt'].size)]))
    merged = {**all_dt, **actual}
    if mapped_country in result['countries']:
      result['countries'][mapped_country]['diffs'] = {
        'infected': [merged[day]['cases'] for day in range(dt.days+1)],
        'deaths': [merged[day]['deaths'] for day in range(dt.days+1)],
      }
  print()


def parse_latest(filename, result):
  if verbosity > 0:
    print('Parsing "{:s}" ...'.format(filename))
  latest = pd.read_csv(os.path.join(path_latest, 'cases_country.csv'))
  for _, d in latest.iterrows():
    row = d.array
    result['countries'][row[0]]['latest'] = {
        'last_update': row[1],
        'where': {
            'lat': round(float(row[2]), 5) if is_float(row[2]) else None,
            'lon': round(float(row[3]), 5) if is_float(row[3]) else None,
        },
        'total': int(row[4]) if is_float(row[4]) else None,
        'deaths': int(row[5]) if is_float(row[5]) else None,
        'recovered': int(row[6]) if is_float(row[6]) else None,
        'active': int(row[7]) if is_float(row[7]) else None,
    }


def sir_model(y, x, beta, gamma):
  S = -beta * y[0] * y[1]
  R = gamma * y[1]
  I = -(S + R)
  return S, I, R


def _fit(s0, i0, r0, index, x, beta, gamma):
  return integrate.odeint(sir_model, (s0, i0, r0), x, args=(beta, gamma))[:,index]


def main():
  print('''
Covid-19 data post-processor.
Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>
''')

  if verbosity > 0:
    print('Current working directory: {:s}'.format(os.getcwd()))

  confirmed_global = pd.read_csv(os.path.join(path_timeseries, 'time_series_covid19_confirmed_global.csv'))\
    .groupby('Country/Region').sum()
  deaths_global = pd.read_csv(os.path.join(path_timeseries, 'time_series_covid19_deaths_global.csv'))\
    .groupby('Country/Region').sum()
  recovered_global = pd.read_csv(os.path.join(path_timeseries, 'time_series_covid19_recovered_global.csv'))\
    .groupby('Country/Region').sum()

  result = { 'countries': {} }
  load_world_data(result)
  parse_latest(os.path.join(path_latest, 'cases_country.csv'), result)

  with open(os.path.join(dst_path, 'countries.json'), 'w+') as out:
    countries = {}
    for country in confirmed_global.index.tolist():
      countries[country] = {
        'flag': result['countries'][country]['flag'],
        'population': result['countries'][country]['population']
      }
    out.write(json.dumps(countries))

  dates = [datetime.strptime(d, '%m/%d/%y') for d in confirmed_global.columns[2:].tolist()]
  retrospect_days = 7
  dt = dates[-1] - timedelta(days=retrospect_days)

  load_ecdc_diff_data(result, dates)

  day0 = '{:d}/{:d}/{:d}'.format(dt.month, dt.day, dt.year - 2000)
  xdata = np.array(range(retrospect_days+1), dtype=float)

  if verbosity > 0:
    print('Processing CSSE data ...')
  for country in sorted(confirmed_global.index.tolist()):
    if verbosity > 0:
      print(' - {}'.format(country), end='')
      sys.stdout.write("\033[K\r")
      sys.stdout.flush()
    confirmed = confirmed_global.loc[country][start_date:]
    deaths = deaths_global.loc[country][start_date:]
    recovered = recovered_global.loc[country][start_date:]
    active = confirmed - deaths - recovered
    doubling_rates = [None]
    for i in range(1, active.values.size):
      prev_active = active.values[i - 1]
      curr_active = active.values[i]
      if prev_active > 0 and curr_active > prev_active:
        doubling_rates.append(round(1 / np.log2(curr_active / prev_active), 2))
      else:
        doubling_rates.append(None)

    if not country in excluded_from_prediction:
      result['countries'][country]['predicted'] = {}
      # Calculate SIR
      population = result['countries'][country]['population']
      infected = active[day0:]
      removed = recovered[day0:] + deaths[day0:]
      susceptible = population - infected - removed
      s = susceptible / population
      i = infected / population
      r = removed / population
      s0 = s.values[0]
      i0 = i.values[0]
      r0 = r.values[0]
      fit_s = partial(_fit, s0, i0, r0, 0)
      fit_i = partial(_fit, s0, i0, r0, 1)
      fit_r = partial(_fit, s0, i0, r0, 2)
      try:
        popt_s, _pcov = optimize.curve_fit(fit_s, xdata, s.values)
        popt_i, _pcov = optimize.curve_fit(fit_i, xdata, i.values)
        popt_r, _pcov = optimize.curve_fit(fit_r, xdata, r.values)
      except RuntimeError as e:
        print('WARNING: {}'.format(e), file=sys.stdout)

      result['countries'][country]['predicted']['SIR'] = {
        'from_date': dt.strftime('%Y-%m-%d'),
        # 't': xdata.tolist(),
        'S': { 'beta': popt_s[0], 'gamma': popt_s[1] },
        'I': { 'beta': popt_i[0], 'gamma': popt_i[1] },
        'R': { 'beta': popt_r[0], 'gamma': popt_r[1] },
      }

    result['countries'][country]['doubling_rates'] = doubling_rates
    result['countries'][country]['total'] = confirmed.values.astype(int).tolist()
    result['countries'][country]['active'] = active.values.astype(int).tolist()
    result['countries'][country]['recovered'] = recovered.values.astype(int).tolist()
    result['countries'][country]['deaths'] = deaths.values.astype(int).tolist()

    json_file = json_file_template.format(country=country)
    if verbosity > 1:
      print('  Writing result to "{}" ...'.format(json_file))

    with open(json_file, 'w+') as out:
      output_data = result['countries'][country]
      output_data['first_date'] = dates[0].strftime('%Y-%m-%d')
      output_data['country'] = country
      out.write(json.dumps(output_data))
      if verbosity > 1:
        print('  Ready.')
  print()


if __name__ == '__main__':
  main()
