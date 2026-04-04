import os
import ast
import pandas as pd
import sqlite3

file_path = os.path.join(os.getcwd(), "events.txt")

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()


chunks = content.split('$$$')

event_list = []

for chunk in chunks:
    if not chunk.strip():
        continue

    data = ast.literal_eval(chunk)

    for event in data:
        summary = event.get("summary", "")
        start_data = event.get("start") or {}
        end_data = event.get("end") or {}

        start_time = start_data.get("date") or start_data.get("dateTime")
        end_time = end_data.get("date") or end_data.get("dateTime")

        event_list.append((summary, start_time, end_time))

event_list = list(set(event_list))

not_names = [
    'horário', 'entrada', 'flight', 'sexta-feira', 'véspera', 
    'restauração', 'advogada', 'implantação', 'natal', 'carnaval', 
    'ano', 'frança', 'portugal', 'mãe', '🧳✈️🛬', '🌈', 'óculos', 'fara','dia','corpo','páscoa']

client_events = []
for event in event_list:
    if event[0].lower().split(' ')[0] not in not_names:
        client_events.append((event[0].lower().split(' ')[0],event[1],event[2]))

df = pd.DataFrame(client_events, columns=[
    "client_name", "start_time", "end_time"
])

df['Gain'] = 15
df['Cost'] = 3


# create in-memory database
conn = sqlite3.connect(":memory:")

# write the DataFrame to a table
df.to_sql("events", conn, index=False, if_exists="replace")

query = """
SELECT 
    strftime('%Y-%m', start_time) AS month,
    SUM(Gain) AS total_gain,
    SUM(Cost) AS total_cost
FROM events
GROUP BY month
ORDER BY month
"""

monthly = pd.read_sql(query, conn)
print(monthly)
# query ="""
# select strftime('%H', start_time) as hour, count(*) as event_count from events group by hour
# """
# print(pd.read_sql(query, conn))

# query = """
# select * from (
# select *,strftime('%H', start_time) as hour from events) where hour = '00' """

# print(pd.read_sql(query, conn))









# print(df.groupby('client_name')[['Gain', 'Cost']].sum())
# print(df[['Gain','Cost']].sum())
# print(len(client_events))
# print(df['start_time'].min())
# print(df['end_time'].max())
# print(monthly)