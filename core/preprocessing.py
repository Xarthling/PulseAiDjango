import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA
from rapidfuzz import process
from geopy.geocoders import Nominatim


class DataPreprocessor:
    def __init__(self, file_path=None, data=None):
        if file_path is not None:
            with open(file_path, 'rb') as file:
                self.data = pd.read_csv(file)
        elif isinstance(data, pd.DataFrame):
            self.data = data.copy()
        else:
            raise ValueError("You must provide either a valid 'file_path' or a 'data' DataFrame.")
        # self.remove_duplicate_columns()
        

    def add_location_info(self, latitude_col='Latitude', longitude_col='Longitude'):
        if latitude_col not in self.data.columns or longitude_col not in self.data.columns:
            raise ValueError("Latitude and Longitude columns are required.")

        geolocator = Nominatim(user_agent="location_lookup")

        def get_location(lat, lon):
            try:
                location = geolocator.reverse((lat, lon), timeout=10)
                if location and location.raw.get('address'):
                    address = location.raw['address']
                    return {
                        'Location': address.get('road', 'Unknown'),
                        'City': address.get('city', 'Unknown'),
                        'State': address.get('state', 'Unknown'),
                        'Region': address.get('region', 'Unknown')
                    }
                return {'Location': 'Unknown', 'City': 'Unknown', 'State': 'Unknown', 'Region': 'Unknown'}
            except Exception:
                return {'Location': 'Unknown', 'City': 'Unknown', 'State': 'Unknown', 'Region': 'Unknown'}

        location_info = self.data.apply(
            lambda row: pd.Series(get_location(row[latitude_col], row[longitude_col])), axis=1
        )
        self.data = pd.concat([self.data, location_info], axis=1)

    def remove_duplicate_columns(self):
        self.data = self.data.loc[:, ~self.data.columns.duplicated()]

    def inspect_data(self):
        print("Dataset Info:")
        print(self.data.info())
        print("\nBasic Statistics:")
        print(self.data.describe())
        print("\nMissing Values:")
        print(self.data.isnull().sum())
        print("\nSample Data:")
        print(self.data.head())

    def handle_missing_data(self, strategies=None, fill_values=None):
        strategies = strategies or {}
        fill_values = fill_values or {}

        for column in self.data.columns:
            if self.data[column].dtype in [np.float64, np.int64]:
                unique_values = self.data[column].dropna().unique()
                strategy = strategies.get(column, "most_frequent" if set(unique_values).issubset({0, 1}) else "mean")
            elif self.data[column].dtype == 'bool':
                self.data[column] = self.data[column].astype(int)
                strategy = strategies.get(column, "most_frequent")
            else:
                strategy = strategies.get(column, "most_frequent")

            fill_value = fill_values.get(column, None)
            if strategy == "constant" and fill_value is None:
                raise ValueError(f"Constant fill_value must be provided for column '{column}' when strategy is 'constant'.")

            imputer = SimpleImputer(strategy=strategy, fill_value=fill_value)
            self.data[[column]] = imputer.fit_transform(self.data[[column]])

    def synonym_mapping(self, synonym_dict, fuzzy_threshold=80):
        reverse_mapping = {synonym: standard_label for standard_label, synonyms in synonym_dict.items() for synonym in synonyms}
        standardized_columns = {}
        unmatched_columns = {}

        for col in self.data.columns:
            if col in reverse_mapping:
                standardized_columns[col] = reverse_mapping[col]
            else:
                result = process.extractOne(col, reverse_mapping.keys())
                if result:
                    match, score = result[0], result[1]
                    if score >= fuzzy_threshold:
                        standardized_columns[col] = reverse_mapping[match]
                    else:
                        unmatched_columns[col] = match if match else "No suitable match"
                else:
                    unmatched_columns[col] = "No suitable match"

        # Rename matched columns
        self.data.rename(columns=standardized_columns, inplace=True)

        # Drop unmatched columns
        self.data.drop(columns=unmatched_columns, inplace=True)        
        return self.data, unmatched_columns

    def remove_duplicates(self):
        self.data = self.data.drop_duplicates()

    def handle_outliers(self, column, method="zscore", threshold=3):
        if method == "zscore":
            z_scores = np.abs((self.data[column] - self.data[column].mean()) / self.data[column].std())
            self.data = self.data[z_scores < threshold]
        elif method == "iqr":
            Q1 = self.data[column].quantile(0.25)
            Q3 = self.data[column].quantile(0.75)
            IQR = Q3 - Q1
            self.data = self.data[(self.data[column] >= Q1 - 1.5 * IQR) & (self.data[column] <= Q3 + 1.5 * IQR)]

    def detect_outliers(self, column_name):
        if column_name not in self.data.columns:
            raise ValueError(f"Column '{column_name}' does not exist in the dataset.")

        z_scores = np.abs((self.data[column_name] - self.data[column_name].mean()) / self.data[column_name].std())
        return self.data[z_scores > 3]

    def process_outliers(self):
        numerical_columns = self.data.select_dtypes(include=[np.number]).columns
        columns_with_outliers = []
        for column in numerical_columns:
            outliers = self.detect_outliers(column)
            if not outliers.empty:
                columns_with_outliers.append(column)
                self.handle_outliers(column=column, method="iqr")

        if not columns_with_outliers:
            print("No outliers detected in any numerical columns.")
        else:
            print(f"Columns processed for outliers: {columns_with_outliers}")

    def convert_data_types(self, column, dtype):
        self.data[column] = self.data[column].astype(dtype)

    def rename_columns(self, rename_map):
        self.data.rename(columns=rename_map, inplace=True)

    def encode_categorical_data(self, columns, method="onehot"):
        if method == "onehot":
            self.data = pd.get_dummies(self.data, columns=columns)
        elif method == "label":
            le = LabelEncoder()
            for col in columns:
                self.data[col] = le.fit_transform(self.data[col])

    def scale_data(self, columns, method="standard"):
        scaler = StandardScaler() if method == "standard" else MinMaxScaler()
        self.data[columns] = scaler.fit_transform(self.data[columns])

    def scale_all_numerical(self, method="standard"):
        numerical_columns = self.data.select_dtypes(include=[np.number]).columns
        scaler = StandardScaler() if method == "standard" else MinMaxScaler()
        self.data[numerical_columns] = scaler.fit_transform(self.data[numerical_columns])

    def handle_text_data(self, column):
        self.data[column] = self.data[column].str.lower().str.replace(r'[^\w\s]', '', regex=True)

    def bin_data(self, column, bins, labels, new_column_name=None):
        binned_data = pd.cut(self.data[column], bins=bins, labels=labels)
        if new_column_name:
            self.data[new_column_name] = binned_data
        else:
            self.data[column] = binned_data

    def process_dates(self):
                    if 'Date' in self.data.columns:
                        try:
                            self.data['Date'] = pd.to_datetime(self.data['Date'], errors='coerce')
                            if self.data['Date'].dtype == 'datetime64[ns]':
                                self.data['Year'] = self.data['Date'].dt.year
                                self.data['Month'] = self.data['Date'].dt.month
                                season_map = {1: 'Winter', 2: 'Spring', 3: 'Summer', 4: 'Autumn'}
                                self.data['Season'] = self.data['Date'].dt.month % 12 // 3 + 1
                                self.data['Season'] = self.data['Season'].map(season_map)
                                self.data['Hour'] = self.data['Date'].dt.hour
                                self.data['Day_of_Week'] = self.data['Date'].dt.day_name()
                                self.data['Week_of_Year'] = self.data['Date'].dt.isocalendar().week
                                self.data['Quarter'] = self.data['Date'].dt.quarter
                                self.data['Is_Weekend'] = self.data['Date'].dt.weekday >= 5
                            else:
                                print("Column 'Date' is not a valid Date column.")
                        except Exception as e:
                            print(f"Error processing column 'Date': {e}")
                    else:
                        print("No 'Date' column found to process.")

    def apply_pca(self, n_components):
        pca = PCA(n_components=n_components)
        self.data = pca.fit_transform(self.data)

    def save_data(self, output_path):
        self.data.to_csv(output_path, index=False)

    def display_data(self):
        print(self.data.head())

    def calculate_rfm_metrics(self, customer_id_col='Customer_ID', date_col='Date', purchase_col='Purchase Amount (USD)'):
        if date_col not in self.data.columns or purchase_col not in self.data.columns or customer_id_col not in self.data.columns:
            pass

        self.data[date_col] = pd.to_datetime(self.data[date_col], errors='coerce')
        self.data['Recency'] = (self.data[date_col].max() - self.data[date_col]).dt.days
        self.data['Frequency'] = self.data.groupby(customer_id_col)[purchase_col].transform('count')
        self.data['Monetary'] = self.data.groupby(customer_id_col)[purchase_col].transform('sum').round(2)

        rfm_metrics = self.data.groupby(customer_id_col).agg({
            'Recency': 'min',
            'Frequency': 'max',
            'Monetary': 'max'
        }).reset_index()

        return rfm_metrics
