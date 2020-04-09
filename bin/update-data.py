#!/usr/bin/env python3

import os
import sys
import csv
import json
import math
import numpy as np
import pandas as pd
from datetime import timedelta, datetime
from scipy import optimize, integrate

verbosity = 1
start_date = '1/22/20'
path_timeseries = os.path.join('COVID-19', 'csse_covid_19_data', 'csse_covid_19_time_series')
data_path = os.path.join('dist', 'data')
population_filename = os.path.join('src', 'data', 'world-data.csv')
json_file_template = os.path.join(data_path, '{country:s}.json')
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
        'total': int(row[4]),
        'deaths': int(row[5]),
        'recovered': int(row[6]),
        'active': int(row[7]),
    }


def predict(confirmed, dates, country, result):
  latest_day = dates[-1]
  day0 = latest_day - timedelta(days=7)
  data = pd.DataFrame(data={'day': dates, 'cases': confirmed})
  cases_since_quarantine = np.array(data[data['day'] >= day0]['cases'])
  if cases_since_quarantine[cases_since_quarantine > 0].size > 0:
    if verbosity > 1:
      print('  Predicting spread of SARS-CoV-2 ...')
    days_since_quarantine = np.array(
        [d.toordinal() for d in data[data['day'] >= day0]['day']])

    def corona_curve(x, b0, x0, k, s):
      return s * 1 / (1 + np.exp(-1 * k * s * (x - x0)) * (s / b0 - 1))

    try:
      params, _ = optimize.curve_fit(
          corona_curve,
          xdata=days_since_quarantine,
          ydata=cases_since_quarantine,
          p0=[
              cases_since_quarantine[0],
              day0.toordinal(),
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
                  (datetime.now() + timedelta(days=prediction_days)).toordinal(),
                  1e-8,
                  result['countries'][country]['population']
              ]
          )
      )
    except ValueError as e:
      print('    **** Prediction failed! ValueError: {}'.format(e), file=sys.stderr)
    else:
      predicted = map(
          lambda day: int(corona_curve(
              (latest_day + timedelta(days=day+1)).toordinal(), *params)),
          range(prediction_days)
      )
      result['countries'][country]['predicted'] = {
          'logistic_function': {
              'from_date': (dates[-1] + timedelta(days=1)).strftime('%Y-%m-%d'),
              'active': list(predicted),
          }
      }


def main():
  print('''
Covid-19 data post-processor.
Copyright (c) 2020 Oliver Lau <oliver@ersatzworld.net>
''')

  if verbosity > 0:
    print('Current working directory: {:s}'.format(os.getcwd()))

  result = { 'countries': {} }
  load_world_data(result)
  parse_latest(os.path.join(path_latest, 'cases_country.csv'), result)

  confirmed_global = pd.read_csv(os.path.join(path_timeseries, 'time_series_covid19_confirmed_global.csv'))\
    .groupby('Country/Region').sum()
  deaths_global = pd.read_csv(os.path.join(path_timeseries, 'time_series_covid19_deaths_global.csv'))\
    .groupby('Country/Region').sum()
  recovered_global = pd.read_csv(os.path.join(path_timeseries, 'time_series_covid19_recovered_global.csv'))\
    .groupby('Country/Region').sum()

  with open(os.path.join(data_path, 'countries.json'), 'w+') as out:
    countries = {}
    for country in confirmed_global.index.tolist():
      countries[country] = {
        'flag': result['countries'][country]['flag'],
        'population': result['countries'][country]['population']
      }
    out.write(json.dumps(countries))

  dates = [datetime.strptime(d, '%m/%d/%y') for d in confirmed_global.columns[2:].tolist()]

  for country in sorted(confirmed_global.index.tolist()):
    if verbosity > 0:
      print(' - {:s}'.format(country))
    confirmed = confirmed_global.loc[country][start_date:]
    deaths = deaths_global.loc[country][start_date:]
    recovered = recovered_global.loc[country][start_date:]
    active = confirmed - deaths - recovered
    doubling_rates = [None]
    deltas = [None]
    for i in range(1, active.values.size):
      prev_cases = active.values[i - 1]
      curr_cases = active.values[i]
      deltas.append(int(curr_cases - prev_cases))
      if prev_cases > 0 and curr_cases > prev_cases:
        doubling_rates.append(round(1 / np.log2(curr_cases / prev_cases), 2))
      else:
        doubling_rates.append(None)

    if not country in excluded_from_prediction:
      predict(confirmed, dates, country, result)

      # Calculate SIR
      retrospect_days = 7
      dt = dates[-1] - timedelta(days=retrospect_days)
      day0 = '{:d}/{:d}/{:d}'.format(dt.month, dt.day, dt.year - 2000)
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
      xdata = np.array(range(retrospect_days+1), dtype=float)

      def sir_model(y, x, beta, gamma):
          S = -beta * y[0] * y[1]
          R = gamma * y[1]
          I = -(S + R)
          return S, I, R

      def fit_s(x, beta, gamma):
          return integrate.odeint(sir_model, (s0, i0, r0), x, args=(beta, gamma))[:,0]

      def fit_i(x, beta, gamma):
          return integrate.odeint(sir_model, (s0, i0, r0), x, args=(beta, gamma))[:,1]

      def fit_r(x, beta, gamma):
          return integrate.odeint(sir_model, (s0, i0, r0), x, args=(beta, gamma))[:,2]

      try:
        popt_s, _pcov = optimize.curve_fit(fit_s, xdata, s.values)
        popt_i, _pcov = optimize.curve_fit(fit_i, xdata, i.values)
        popt_r, _pcov = optimize.curve_fit(fit_r, xdata, r.values)
      except RuntimeError as e:
        print('WARNING: {}'.format(e), file=sys.stdout)

      result['countries'][country]['predicted']['SIR'] = {
        'from_date': dt.strftime('%Y-%m-%d'),
        't': xdata.tolist(),
        'S': { 'beta': popt_s[0], 'gamma': popt_s[1] },
        'I': { 'beta': popt_i[0], 'gamma': popt_i[1] },
        'R': { 'beta': popt_r[0], 'gamma': popt_r[1] },
      }

    result['countries'][country]['delta'] = deltas
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
      output_data['dates'] = [d.strftime('%Y-%m-%d') for d in dates]
      output_data['country'] = country
      out.write(json.dumps(output_data))
      if verbosity > 1:
        print('  Ready.')


if __name__ == '__main__':
  main()
