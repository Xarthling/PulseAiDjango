from datetime import datetime
import pandas as pd

class DataFilter:
    def __init__(self, data):
        self.data = data

    def filter_by_location(self, location):
        if location:
            self.data = self.data[self.data['Location'] == location]

    def filter_by_age_range(self, age_range):
        if age_range:
            self.data = self.data[(self.data['Age'] >= age_range[0]) & (self.data['Age'] <= age_range[1])]

    def filter_by_rating_range(self, rating_range):
        if rating_range:
            self.data = self.data[(self.data['Review Rating'] >= rating_range[0]) & (self.data['Review Rating'] <= rating_range[1])]

    def filter_by_date_range(self, start_date, end_date):
        if start_date and end_date:
            self.data['Date'] = pd.to_datetime(self.data['Date'])
            self.data = self.data[(self.data['Date'] >= start_date) & (self.data['Date'] <= end_date)]

    def get_filtered_data(self):
        return self.data