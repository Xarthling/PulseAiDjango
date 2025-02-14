from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    path('', views.index, name='index'),
    path('upload/', views.upload_file, name='upload'),
    path('filter/', views.filter_data, name='filter'),
    path('generate_report/', views.generate_report, name='generate_report'),
]
