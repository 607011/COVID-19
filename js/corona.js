(function (window) {
    'use strict'
    let locale = 'de-DE'
    const DataUrl = 'COVID-19/csse_covid_19_data/csse_covid_19_time_series/time_series_19-covid-Confirmed.csv'
    let ctx = null
    let prediction_days = 14
    let curr_data = null
    const el = {}

    const update = data => {
        curr_data = data
        const countries = data.rows.filter(value => value.country === 'Germany')
        if (countries.length === 0)
            return
        const country = countries[0]
        if (country.cases.length !== data.dates.length)
            return
        const curr_doubling_rate = country.doubling_rates[country.doubling_rates.length - 1]
        const curr_cases = country.cases[country.cases.length - 1]
        const curr_date = data.dates[data.dates.length - 1]
        country.predicted = new Array(country.cases.length - 1).fill(NaN)
        country.predicted.push(curr_cases)
        for (let d = 1; d <= prediction_days; ++d) {
            country.predicted.push(Math.round(curr_cases * Math.pow(2, d / curr_doubling_rate)))
            const date = new Date(curr_date)
            date.setDate(curr_date.getDate() + d)
            data.dates.push(date)
        }
        el.latest_cases.innerText = country.predicted[country.predicted.length - 1].toLocaleString(locale)
        data.dates = data.dates.map(d => d.toLocaleDateString(locale))
        const _progress_chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
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

    const main = () => {
        ctx = document.getElementById('progress').getContext('2d')
        el.latest_cases = document.getElementById('latest')
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
