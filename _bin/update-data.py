#!/usr/bin/env python3

import datetime as dt
import json
import math
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit

def parse_timeline(filename, key, selected_country, result):
  with open(filename, 'r') as confirmed:
    first_line = confirmed.readline().strip()
    if not 'dates' in result:
      result['dates'] = [dt.datetime.strptime(d, '%m/%d/%y') for d in first_line.split(',')[4:]]
    for line in confirmed:
      row = line.strip().split(',')
      if row[1] == selected_country:
        result[key] = [int(v) for v in row[4:]]
        return

def parse_latest(filename, selected_country, result):
  with open(filename, 'r') as latest:
    latest.readline().strip()  # skip header
    for line in latest:
      row = line.strip().split(',')
      if row[0] == selected_country:
        result['latest'] = {
          'last_update': row[1],
          'where': {
            'lat': float(row[2]),
            'lon': float(row[3]),
          },
          'total': int(row[4]),
          'deaths': int(row[5]),
          'recovered': int(row[6]),
          'active': int(row[7]),
        }
        return

def main():
  selected_country = 'Germany'
  json_file = 'data/current.json'
  result = { 'country': selected_country}
  parse_latest('COVID-19-web-data/data/cases_country.csv', selected_country, result)
  parse_timeline('COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv', 'total', selected_country, result)
  parse_timeline('COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_recovered_global.csv', 'recovered', selected_country, result)
  parse_timeline('COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv', 'deaths', selected_country, result)
  result['active'] = []
  for i in range(len(result['total'])):
    result['active'].append(result['total'][i] - result['recovered'][i] - result['deaths'][i])
  result['doubling_rates'] = []
  for i in range(1, len(result['active'])):
    prev_cases = result['active'][i - 1]
    curr_cases = result['active'][i]
    if prev_cases == curr_cases:
        result['doubling_rates'].append(None)
    elif prev_cases > 0 and curr_cases > 0:
        rate = curr_cases / prev_cases
        doubling_rate = 1 / np.log2(rate)
        result['doubling_rates'].append(round(doubling_rate, 2))
    else:
        result['doubling_rates'].append(None)

  def corona_curve(x, b0, x0, k, s):
    return s * 1 / (1 + np.exp(-1 * k * s * (x - x0)) * (s / b0 - 1))

  first_day_with_quarantine_effect = dt.datetime(year=2020, month=3, day=20)
  data = pd.DataFrame(data={'day': result['dates'], 'cases': result['active']})
  latest_day = result['dates'][-1]
  cases_since_quarantine = np.array(data[data['day'] >= first_day_with_quarantine_effect]['cases'])
  day_no_since_quarantine = np.array([d.toordinal() for d in data[data['day'] >= first_day_with_quarantine_effect]['day']])
  params, _ = curve_fit(
      corona_curve,
      xdata=day_no_since_quarantine, 
      ydata=cases_since_quarantine, 
      p0=[
        cases_since_quarantine[0],
        first_day_with_quarantine_effect.toordinal(),
        8e-9,
        5.6e7],
      bounds=(
          [
            0,
            day_no_since_quarantine[0],
            1e-11,
            cases_since_quarantine[-1]
          ],
          [
            cases_since_quarantine[-1],
            dt.datetime(year=2021, month=6, day=1).toordinal(),
            1e-8,
            8.35e7
          ]
      )
  )
  data = data[data['day'] >= first_day_with_quarantine_effect]
  projection_data = data.copy()
  projection_data = projection_data.drop(['cases'], axis=1)
  projection_data['curve'] = [corona_curve(d.toordinal(), *params) for d in projection_data['day']]
  for i in range(180):
      projection_data = projection_data.append(pd.DataFrame(
          [[list(projection_data['day'])[-1] + dt.timedelta(days=1), 
            corona_curve((list(projection_data['day'])[-1] + dt.timedelta(days=1)).toordinal(), *params)]],
          columns=('day', 'curve')
      ), ignore_index=True)
  predicted = [int(round(d)) for d in projection_data['curve'][projection_data['day'] > latest_day].to_numpy()]
  result['predicted'] = {
    'from_date': (result['dates'][-1]+ dt.timedelta(days=1)).strftime('%Y-%m-%d'),
    'active': predicted,
  }
  result['dates'] = [d.strftime('%Y-%m-%d') for d in result['dates']]
  with open(json_file, 'w+') as out:
    out.write(json.dumps(result, indent=1))

if __name__ == '__main__':
  main()
