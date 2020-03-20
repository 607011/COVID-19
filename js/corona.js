(function (window) {
    'use strict'
    let locale = 'de-DE'
    const DataUrl = 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv'
    let ctx = null
    let prediction_days = 0
    let curr_data = null
    let progress_chart = null
    const el = {}
    let selected_country = 'Germany'

    const update = new_data => {
        const data = (typeof new_data !== 'undefined') ? new_data : curr_data
        if (data) {
            curr_data = data
        }
        else {
            console.error('no data')
            return
        }
        const countries = data.rows.filter(value => value.country === selected_country)
        if (countries.length === 0) {
            console.error('no data available for country: ' + selected_country)
            return
        }
        const country = countries[0]
        country.dates = data.dates.slice()
        const curr_doubling_rate = country.doubling_rates[country.doubling_rates.length - 1]
        const curr_cases = country.cases[country.cases.length - 1]
        const curr_date = country.dates[country.dates.length - 1]
        country.predicted = new Array(country.cases.length - 1).fill(NaN)
        country.predicted.push(curr_cases)
        for (let d = 1; d <= prediction_days; ++d) {
            country.predicted.push(Math.round(curr_cases * Math.pow(2, d / curr_doubling_rate)))
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + d)
            country.dates.push(date)
        }
        country.dates = country.dates.map(d => d.toLocaleDateString(locale))
        el.current_date.innerText = curr_date.toLocaleDateString(locale)
        el.current_cases.innerText = curr_cases.toLocaleString(locale)
        el.latest_date.innerText = country.dates[country.dates.length - 1]
        el.latest_cases.innerText = country.predicted[country.predicted.length - 1].toLocaleString(locale)
        if (progress_chart === null) {
            progress_chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: country.dates,
                    datasets: [
                        {
                            yAxisID: 'A',
                            label: 'Bestätigte Fälle',
                            data: country.cases,
                            borderColor: 'rgb(230, 88, 36)',
                            borderWidth: 2,
                            fill: 'transparent',
                            pointStyle: 'rect',
                            showLine: true,
                            spanGaps: true,
                            lineTension: 0.1,
                        },
                        {
                            yAxisID: 'A',
                            label: 'Prognose',
                            data: country.predicted,
                            borderColor: 'rgba(230, 88, 36, 0.8)',
                            borderDash: [ 3, 1 ],
                            fill: 'transparent',
                            pointStyle: 'rect',
                            showLine: true,
                            spanGaps: true,
                            lineTension: 0.1,
                        },
                        {
                            yAxisID: 'B',
                            label: 'Tage pro Verdoppelung',
                            data: country.doubling_rates,
                            borderColor: 'rgb(88, 230, 36)',
                            fill: 'transparent',
                            pointStyle: 'circle',
                            showLine: false,
                            spanGaps: false,
                            lineTension: 0.01,
                        }
                    ]
                },
                options: {
                    title: {
                        display: false,
                        text: 'Covid-19-Ausbreitung in Deutschland',
                    },
                    scales: {
                        yAxes: [
                            {
                                id: 'A',
                                type: 'linear',
                                position: 'left',
                                precision: 1,
                                beginAtZero: true,
                            },
                            {
                                id: 'B',
                                type: 'linear',
                                position: 'right',
                                precision: 0.1,
                                beginAtZero: true,
                            }
                        ]
                    },
                    animation: {
                        duration: 500,
                        easing: 'easeInOutQuad',
                    }
                }
            })
        }
        if (typeof new_data === 'undefined') {
            progress_chart.data.labels = country.dates
            progress_chart.data.datasets[1].data = country.predicted
            progress_chart.update()
        }
    }

    const main = () => {
        ctx = document.getElementById('progress').getContext('2d')
        el.current_date = document.getElementById('current-date')
        el.current_cases = document.getElementById('current-cases')
        el.latest_date = document.getElementById('latest-date')
        el.latest_cases = document.getElementById('latest-cases')
        el.prediction_days = document.getElementById('prediction-days')
        prediction_days = +el.prediction_days.value
        el.prediction_days.addEventListener('change', evt => {
            prediction_days = +evt.target.value
            update()
        })
        fetch(DataUrl, { mode: 'no-cors' })
            .then(response => {
                return response.ok
                    ? response.text()
                    : Promise.reject(response.status)
            })
            .then(raw_data => {
                const data = raw_data.split('\n')
                const dates = data.shift().split(',').slice(4).map(v => new Date(v))
                const rows = []
                for (const row of data) {
                    const [province, country, lat, lon, ...cases] = row.split(',')
                    if (country.length === 0)
                        continue
                    if (!cases.every(n => n >= 0))
                        continue
                    const doubling_rates = [NaN]
                    for (let i = 1; i < cases.length; ++i) {
                        const prev_cases = cases[i - 1]
                        const curr_cases = cases[i]
                        if (prev_cases === curr_cases) {
                            doubling_rates.push(NaN)
                        }
                        else if (prev_cases > 0 && curr_cases > 0) {
                            const rate = curr_cases / prev_cases
                            const doubling_rate = 1 / Math.log2(rate)
                            doubling_rates.push(doubling_rate)
                        }
                        else {
                            doubling_rates.push(NaN)
                        }
                    }
                    rows.push({
                        province: province,
                        country: country,
                        where: {
                            lat: parseFloat(lat),
                            lon: parseFloat(lon)
                        },
                        cases: cases.map(v => +v),
                        doubling_rates: doubling_rates,
                    })
                }
                return {
                    dates: dates,
                    rows: rows,
                }
            })
            .then(update)
    }
    window.addEventListener('load', main)
})(window)
