#!/usr/bin/env python3

import os
import sys
import datetime as dt
import csv
import json
import math
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit


verbosity = 1
json_file_template = 'data/{country:s}.json'
path_latest = os.path.join('COVID-19-web-data', 'data')
path_timeseries = os.path.join('COVID-19', 'csse_covid_19_data', 'csse_covid_19_time_series')
population_filename = os.path.join('data', 'population.csv')
prediction_days = 180

def load_world_population_data(result):
  with open(population_filename, 'r') as f:
    reader = csv.reader(f, delimiter='\t', quotechar='"')
    for row in reader:
      result['countries'][row[0]] = {
        'population': int(row[1]),
      }


def parse_latest(filename, result):
  if verbosity > 0:
    print('Parsing "{:s}" ...'.format(filename))
  with open(filename, 'r') as latest:
    reader = csv.reader(latest, delimiter=',', quotechar='"')
    reader.__next__()  # skip header
    for row in reader:
      country = row[0]
      if not country in result['countries']:
        result['countries'][country] = {}
      result['countries'][country]['latest'] = {
          'last_update': row[1],
          'where': {
              'lat': round(float(row[2]), 5),
              'lon': round(float(row[3]), 5),
          },
          'total': int(row[4]),
          'deaths': int(row[5]),
          'recovered': int(row[6]),
          'active': int(row[7]),
      }


def parse_timeseries(filename, key, result):
  if verbosity > 0:
    print('Parsing "{:s}" ...'.format(filename))
  with open(filename, 'r') as confirmed:
    reader = csv.reader(confirmed, delimiter=',', quotechar='"')
    first_line = reader.__next__()
    if not 'dates' in result:
      result['dates'] = [dt.datetime.strptime(d, '%m/%d/%y') for d in first_line[4:]]
    for row in reader:
      country = row[1]
      if not country in result['countries']:
        result['countries'][country] = {}
      if not key in result['countries'][country]:
        result['countries'][country][key] = np.array([int(v) for v in row[4:]])
      else:
        result['countries'][country][key] = np.add(result['countries'][country][key], [int(v) for v in row[4:]])
  for country in result['countries']:
    if key in result['countries'][country]:
      result['countries'][country][key] = result['countries'][country][key].tolist()


def corona_curve(x, b0, x0, k, s):
  return s * 1 / (1 + np.exp(-1 * k * s * (x - x0)) * (s / b0 - 1))


def main():
  print('''
SARS-CoV-2 data helper.
Copyright (c) 2020 Oliver Lau <oliver.lau@gmail.com>
''')

  if verbosity > 0:
    print('Current working directory: {:s}'.format(os.getcwd()))


  result = { 'countries': {} }
  load_world_population_data(result)
  parse_latest(os.path.join(path_latest, 'cases_country.csv'), result)
  parse_timeseries(os.path.join(path_timeseries, 'time_series_covid19_confirmed_global.csv'), 'total', result)
  parse_timeseries(os.path.join(path_timeseries, 'time_series_covid19_recovered_global.csv'), 'recovered', result)
  parse_timeseries(os.path.join(path_timeseries, 'time_series_covid19_deaths_global.csv'), 'deaths', result)

  # TODO: accumulate country data to produce world data

  with open('data/countries.json', 'w+') as out:
     out.write(json.dumps(list(result['countries'].keys())))

  dates = None
  for country, d in sorted(result['countries'].items()):
    if not 'total' in d:
      continue
    if verbosity > 0:
      print('- {:s} (population: {:d})'.format(country, result['countries'][country]['population']))
    if verbosity > 1:
      print('  Calculating active cases ...')
    d['active'] = []
    for i in range(len(d['total'])):
      diff = d['total'][i] - d['recovered'][i] - d['deaths'][i]
      d['active'].append(diff if diff > 0 else 0)
    if verbosity > 1:
      print('  Calculating doubling rates and differences ...')
    d['doubling_rates'] = [None]
    d['delta'] = [None]
    for i in range(1, len(d['active'])):
      prev_cases = d['active'][i - 1]
      curr_cases = d['active'][i]
      d['delta'].append(curr_cases - prev_cases)
      if prev_cases > 0 and curr_cases > prev_cases:
        d['doubling_rates'].append(round(1 / np.log2(curr_cases / prev_cases), 2))
      else:
        d['doubling_rates'].append(None)

    day1_quarantine = dt.datetime(year=2020, month=3, day=20)
    data = pd.DataFrame(data={'day': result['dates'], 'cases': d['total']})
    cases_since_quarantine = np.array(data[data['day'] >= day1_quarantine]['cases'])

    if cases_since_quarantine[cases_since_quarantine > 0].size > 0:
      if verbosity > 1:
        print('  Predicting spread of SARS-CoV-2 ...')
      latest_day = result['dates'][-1]
      days_since_quarantine = np.array([d.toordinal() for d in data[data['day'] >= day1_quarantine]['day']])
      try:
        params, _ = curve_fit(
            corona_curve,
            xdata=days_since_quarantine,
            ydata=cases_since_quarantine,
            p0=[
                cases_since_quarantine[0],
                day1_quarantine.toordinal(),
                8e-9,
                int(result['countries'][country]['population'] / 2)
            ],
            bounds=(
                [
                    0,
                    days_since_quarantine[0],
                    1e-11,
                    cases_since_quarantine[-1]
                ],
                [
                    cases_since_quarantine[-1],
                    (dt.datetime.now() + dt.timedelta(days=prediction_days)).toordinal(),
                    1e-8,
                    result['countries'][country]['population']
                ]
            )
        )
      except ValueError as e:
        print('    **** Prediction failed! ValueError: {}'.format(e), file=sys.stderr)
      else:
        data = data[data['day'] >= day1_quarantine]
        projection = data.copy()
        projection = projection.drop(['cases'], axis=1)
        projection['curve'] = [corona_curve(d.toordinal(), *params) for d in projection['day']]
        for i in range(prediction_days):
            projection = projection.append(pd.DataFrame(
                [[list(projection['day'])[-1] + dt.timedelta(days=1),
                  corona_curve((list(projection['day'])[-1] + dt.timedelta(days=1)).toordinal(), *params)]],
                columns=('day', 'curve')
            ), ignore_index=True)
        predicted = [int(round(d)) for d in projection['curve'][projection['day'] > latest_day].to_numpy()]
        result['countries'][country]['predicted'] = {
            'from_date': (result['dates'][-1] + dt.timedelta(days=1)).strftime('%Y-%m-%d'),
            'active': predicted,
        }

    json_file = json_file_template.format(country=country)
    if verbosity > 1:
      print('  Writing result to "{}" ...'.format(json_file))
    with open(json_file, 'w+') as out:
      if not dates:
        dates = [d.strftime('%Y-%m-%d') for d in result['dates']]
      output_data = result['countries'][country]
      output_data['dates'] = dates
      output_data['country'] = country
      out.write(json.dumps(output_data))
      if verbosity > 1:
        print('  Ready.')


if __name__ == '__main__':
  main()
