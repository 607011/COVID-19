#!/usr/bin/env python3

import os
import sys
from datetime import timedelta, datetime
import csv
import json
import math
import numpy as np
import pandas as pd
from scipy.optimize import curve_fit, minimize
from scipy.integrate import solve_ivp
import matplotlib.pyplot as plt

verbosity = 1
json_file_template = 'data/{country:s}.json'
path_latest = os.path.join('COVID-19-web-data', 'data')
population_filename = os.path.join('data', 'world-data.csv')
prediction_days = 40


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
              'lat': round(float(row[2]), 5) if row[2] != '' else row[2],
              'lon': round(float(row[3]), 5) if row[3] != '' else row[3],
          },
          'total': int(row[4]),
          'deaths': int(row[5]),
          'recovered': int(row[6]),
          'active': int(row[7]),
      }


def corona_curve(x, b0, x0, k, s):
  return s * 1 / (1 + np.exp(-1 * k * s * (x - x0)) * (s / b0 - 1))


class Covid19:
  PathTimeseries = os.path.join(
      'COVID-19', 'csse_covid_19_data', 'csse_covid_19_time_series')

  def __init__(self, country, loss, start_date, predict_range, s0, i0, r0):
    self.country = country
    self.loss = loss
    self.start_date = start_date
    self.predict_range = predict_range
    self.s0 = s0
    self.i0 = i0
    self.r0 = r0

  def load_confirmed(self, country):
    df = pd.read_csv(os.path.join(Covid19.PathTimeseries,
                                  'time_series_covid19_confirmed_global.csv'))
    country_df = df[df['Country/Region'] == country]
    print(country_df)
    return country_df.iloc[0].loc[self.start_date:]

  def load_recovered(self, country):
    df = pd.read_csv(os.path.join(Covid19.PathTimeseries,
                                  'time_series_covid19_recovered_global.csv'))
    country_df = df[df['Country/Region'] == country]
    print(country_df)
    return country_df.iloc[0].loc[self.start_date:]

  def load_deaths(self, country):
    df = pd.read_csv(os.path.join(Covid19.PathTimeseries,
                                  'time_series_covid19_deaths_global.csv'))
    country_df = df[df['Country/Region'] == country]
    print(country_df)
    return country_df.iloc[0].loc[self.start_date:]

  def extend_index(self, index, new_size):
    values = index.values
    current = datetime.strptime(index[-1], '%m/%d/%y')
    while len(values) < new_size:
      current = current + timedelta(days=1)
      values = np.append(values, datetime.strftime(current, '%m/%d/%y'))
    return values

  def predict(self, beta, gamma, data, recovered, death, country, s0, i0, r0):
    new_index = self.extend_index(data.index, self.predict_range)
    size = len(new_index)

    def SIR(t, y):
        S = y[0]
        I = y[1]
        # R = y[2]
        return [-beta*S*I, beta*S*I-gamma*I, gamma*I]

    extended_actual = np.concatenate((data.values, [None] * (size - len(data.values))))
    extended_recovered = np.concatenate((recovered.values, [None] * (size - len(recovered.values))))
    extended_death = np.concatenate((death.values, [None] * (size - len(death.values))))
    return new_index, \
      extended_actual, extended_recovered, extended_death, \
      solve_ivp(SIR, [0, size], [s0, i0, r0], t_eval=np.arange(0, size, 1))

  def train(self):
    recovered = self.load_recovered(self.country)
    deaths = self.load_deaths(self.country)
    data = (self.load_confirmed(self.country) - recovered - deaths)
    optimal = minimize(loss, [0.001, 0.001],
        args=(data, recovered, self.s0, self.i0, self.r0),
        method='L-BFGS-B',
        bounds=[(0.00000001, 0.4), (0.00000001, 0.4)]
    )
    print(optimal)
    beta, gamma = optimal.x
    new_index, extended_actual, extended_recovered, extended_death, prediction = self.predict(
        beta, gamma, data, recovered, deaths, self.country, self.s0, self.i0, self.r0)
    df = pd.DataFrame({'active': extended_actual, 'recovered': extended_recovered, 'deaths': extended_death,
                        'S': prediction.y[0], 'I': prediction.y[1], 'R': prediction.y[2]}, index=new_index)
    print(df)
    fig, ax = plt.subplots(figsize=(15, 10))
    ax.set_title(self.country)
    df.plot(ax=ax)
    fig.savefig(f"{self.country}.png")

def loss(point, data, recovered, s0, i0, r0):
    size = len(data)
    beta, gamma = point
    print(point, s0, i0, r0)
    def SIR(t, y):
        S = y[0]
        I = y[1]
        # R = y[2]
        return [-beta*S*I, beta*S*I-gamma*I, gamma*I]
    solution = solve_ivp(SIR, [0, size], [s0, i0, r0], t_eval=np.arange(0, size, 1), vectorized=True)
    l1 = np.sqrt(np.mean((solution.y[1] - data)**2))
    l2 = np.sqrt(np.mean((solution.y[2] - recovered)**2))
    alpha = 0.1
    return alpha * l1 + (1 - alpha) * l2


def main():
  print('''
Covid-19 SIR modeler.
Copyright (c) 2020 Kai Sasaki, https://github.com/Lewuathe/COVID19-SIR
''')

  if verbosity > 0:
    print('Current working directory: {:s}'.format(os.getcwd()))

  result = { 'countries': {} }
  load_world_data(result)
  parse_latest(os.path.join(path_latest, 'cases_country.csv'), result)

  learner = Covid19('Germany', loss, '3/20/20', prediction_days, 20_000, 19848, 180)
  learner.train()


if __name__ == '__main__':
  main()
