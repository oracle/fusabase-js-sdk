-- Copyright (c) 2015, 2025, Oracle and/or its affiliates.

-------------------------------------------------------------------------------
--
-- This software is dual-licensed to you under the Universal Permissive License
-- (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
-- 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
-- either license.
--
-- If you elect to accept the software under the Apache License, Version 2.0,
-- the following applies:
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--    https://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-------------------------------------------------------------------------------
-- 

conn username/password@cdb1_pdb3;
set serveroutput on;
select obaas.settrace(1);
begin
  select project_id into :project_id from table(obaas.LIST_PROJECTS)
    where role = 'OWNER';
end;
/

drop table photo_likes;
drop table comments_likes;
drop table comments;
drop table photo;
drop table album;
drop table users;
drop table album_likes;

create table users (uuid number,name varchar2(1000),age number,about clob);
create table photo (uuid number,uname varchar2(1000),pid number,aid number,content clob,created date);
create table comments (cid number,pid number,data clob);
create table photo_likes(pid number  not null,count number  not null);
create table comments_likes (cid number  not null,count number  not null);
create table album (aid number,aname varchar2(1000));
create table user_ph (uuid number,phone number);
create table album_likes(aid number,likesid number,count number);

alter table users add constraint u1_pk PRIMARY KEY (uuid);
alter table photo add constraint p_pk PRIMARY KEY (pid);
alter table comments add constraint c_pk PRIMARY KEY (cid);
alter table album add constraint a_pk PRIMARY KEY (aid);

alter table users add constraint u1_uk UNIQUE (name,uuid);
alter table album add constraint a_uk UNIQUE (aid,aname);
alter table user_ph add constraint ph_pk primary key (phone);
alter table album_likes add constraint likes_pk primary key (likesid);

ALTER TABLE photo ADD constraint p_fk FOREIGN KEY (uuid,uname) REFERENCES users(uuid,name);
ALTER TABLE photo ADD constraint p_fk1 FOREIGN KEY (aid) REFERENCES album(aid);
ALTER TABLE comments ADD constraint c_fk FOREIGN KEY (pid) REFERENCES photo(pid);
ALTER TABLE photo_likes ADD constraint pl_fk FOREIGN KEY (pid) REFERENCES photo(pid);
ALTER TABLE comments_likes ADD constraint cl_fk FOREIGN KEY (cid) REFERENCES comments(cid);
alter table user_ph add constraint ph_fk foreign key (uuid) references users(uuid);
ALTER TABLE photo_likes ADD constraint pl_uk UNIQUE  (pid,count);
ALTER TABLE comments_likes ADD constraint cl_uk UNIQUE  (cid,count);
alter table album_likes add constraint likes_fk foreign key (aid) references album(aid);

insert into users values(1,'pratik',29,to_clob('hi pratik'));
insert into users values(2,'hrishabh',23,to_clob('hi hrishabh'));
insert into users values(3,'himanshu',28,to_clob('hi himanshu'));
insert into users values(4,'chirag',23,to_clob('hi chirag'));
insert into users values(5,'ryan',29,to_clob('hi ryan'));

insert into user_ph values(1,123);
insert into user_ph values(2,234);
insert into album values(100,'oracle');
insert into album values(101,'oracle1');

insert into album_likes(aid,likesid,count) values(100,1,1);
insert into album_likes(aid,likesid,count) values(101,2,2);
insert into album_likes(aid,likesid,count) values(100,3,3);
insert into album_likes(aid,likesid,count) values(101,4,4);

insert into photo values(1,'pratik',1000,100,to_blob(HEXTORAW('A')),
                         TO_DATE('2015/05/15 8:30:25', 'YYYY/MM/DD HH:MI:SS'));
insert into photo values(1,'pratik',1001,100,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(2,'hrishabh',1002,100,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(2,'hrishabh',1003,100,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(3,'himanshu',1004,100,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(3,'himanshu',1005,101,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(4,'chirag',1006,101,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(4,'chirag',1007,101,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(5,'ryan',1008,101,to_blob(HEXTORAW('A')),sysdate);
insert into photo values(5,'ryan',1009,101,to_blob(HEXTORAW('A')),sysdate);


insert into comments values(10000,1000,to_clob('nicephoto1'));
insert into comments values(10001,1000,to_clob('nicephoto2'));
insert into comments values(10002,1001,to_clob('nicephoto3'));
insert into comments values(10003,1001,to_clob('nicephoto4'));
insert into comments values(10004,1002,to_clob('nicephoto5'));
insert into comments values(10005,1002,to_clob('nicephoto6'));
insert into comments values(10006,1003,to_clob('nicephoto7'));
insert into comments values(10007,1003,to_clob('nicephoto8'));
insert into comments values(10008,1004,to_clob('nicephoto9'));
insert into comments values(10009,1004,to_clob('nicephoto11'));
insert into comments values(10010,1005,to_clob('nicephoto12'));
insert into comments values(10011,1005,to_clob('nicephoto13'));
insert into comments values(10012,1006,to_clob('nicephoto14'));
insert into comments values(10013,1006,to_clob('nicephoto15'));
insert into comments values(10014,1007,to_clob('nicephoto16'));
insert into comments values(10015,1007,to_clob('nicephoto17'));
insert into comments values(10016,1008,to_clob('nicephoto18'));
insert into comments values(10017,1008,to_clob('nicephoto19'));
insert into comments values(10018,1009,to_clob('nicephoto20'));
insert into comments values(10019,1009,to_clob('nicephoto21'));

insert into photo_likes values(1000,1);
insert into photo_likes values(1001,1);
insert into photo_likes values(1002,1);
insert into photo_likes values(1003,1);
insert into photo_likes values(1004,1);
insert into photo_likes values(1005,1);
insert into photo_likes values(1006,1);
insert into photo_likes values(1007,1);
insert into photo_likes values(1008,1);
insert into photo_likes values(1009,1);

insert into comments_likes values(10000,1);
insert into comments_likes values(10001,1);
insert into comments_likes values(10002,1);
insert into comments_likes values(10003,1);
insert into comments_likes values(10004,1);
insert into comments_likes values(10005,1);
insert into comments_likes values(10006,1);
insert into comments_likes values(10007,1);
insert into comments_likes values(10008,1);
insert into comments_likes values(10009,1);
insert into comments_likes values(10010,1);
insert into comments_likes values(10011,1);


declare
 l_project_id varchar2(50);
 result  number;
begin 
 select project_id into l_project_id from table(obaas.list_projects);
 result := obaas.OBAAS_SETUP_RELMETADATA(l_project_id, 
'["users", "ALBUM", "PHOTO", 
   "PHOTO", "COMMENTS"]',
  '["PHOTO", "ALBUM_LIKES", "COMMENTS",
   "PHOTO_LIKES", "COMMENTS_LIKES"]', 1) ;
 dbms_output.put_line('Status: ' || result);
 obaas.OBAAS_CLEAN_RELMETADATA(result);
 dbms_output.put_line('Status clean: ' || result);
 result := obaas.OBAAS_SETUP_RELMETADATA(l_project_id, 
'["users", "ALBUM", "photo", 
   "photo", "Comments"]',
  '["photo", "album_likes", "Comments",
   "PHOTO_likes", "COMMENTS_likes"]', 1) ;
 dbms_output.put_line('Status: ' || result);
end;
/

commit;

conn username/password@cdb1_pdb3;
set serveroutput on;
select obaas.settrace(1);

var project_id    VARCHAR2(100);

begin
    select project_id into :project_id from table(obaas.LIST_PROJECTS) 
        where role = 'OWNER';
end;
/

drop table if exists emp purge;
drop table if exists dept purge;

create table dept (
  deptno number(2) constraint pk_dept primary key,
  dname varchar2(14),
  loc varchar2(13)
) ;

create table emp (
  empno number(4) constraint pk_emp primary key,
  ename varchar2(10),
  job varchar2(9),
  mgr number(4),
  hiredate date,
  sal number(7,2),
  comm number(7,2),
  deptno number(2) constraint fk_deptno references dept
);

insert into dept values (10,'ACCOUNTING','NEW YORK');
insert into dept values (20,'RESEARCH','DALLAS');
insert into dept values (30,'SALES','CHICAGO');
insert into dept values (40,'OPERATIONS','BOSTON');

insert into emp values (7369,'SMITH','CLERK',7902,to_date('17-12-1980','dd-mm-yyyy'),800,null,20);
insert into emp values (7499,'ALLEN','SALESMAN',7698,to_date('20-2-1981','dd-mm-yyyy'),1600,300,30);
insert into emp values (7521,'WARD','SALESMAN',7698,to_date('22-2-1981','dd-mm-yyyy'),1250,500,30);
insert into emp values (7566,'JONES','MANAGER',7839,to_date('2-4-1981','dd-mm-yyyy'),2975,null,20);
insert into emp values (7654,'MARTIN','SALESMAN',7698,to_date('28-9-1981','dd-mm-yyyy'),1250,1400,30);
insert into emp values (7698,'BLAKE','MANAGER',7839,to_date('1-5-1981','dd-mm-yyyy'),2850,null,30);
insert into emp values (7782,'CLARK','MANAGER',7839,to_date('9-6-1981','dd-mm-yyyy'),2450,null,10);
insert into emp values (7788,'username','ANALYST',7566,to_date('13-JUL-87','dd-mm-rr')-85,3000,null,20);
insert into emp values (7839,'KING','PRESIDENT',null,to_date('17-11-1981','dd-mm-yyyy'),5000,null,10);
insert into emp values (7844,'TURNER','SALESMAN',7698,to_date('8-9-1981','dd-mm-yyyy'),1500,0,30);
insert into emp values (7876,'ADAMS','CLERK',7788,to_date('13-JUL-87', 'dd-mm-rr')-51,1100,null,20);
insert into emp values (7900,'JAMES','CLERK',7698,to_date('3-12-1981','dd-mm-yyyy'),950,null,30);
insert into emp values (7902,'FORD','ANALYST',7566,to_date('3-12-1981','dd-mm-yyyy'),3000,null,20);
insert into emp values (7934,'MILLER','CLERK',7782,to_date('23-1-1982','dd-mm-yyyy'),1300,null,10);
commit;

create or replace json relational duality view department_dv as
select json {'_id' : d.deptno,
             'OID' : SYS_MAKE_OID_FROM_PK(d.deptno),
             'departmentName'   : d.dname,
             'location'         : d.loc,
             'employees' :
               [ select json {'oid' : SYS_MAKE_OID_FROM_PK(e.empno),
                              'employeeNumber' : e.empno,
                              'employeeName'   : e.ename,
                              'job'            : e.job,
                              'salary'         : e.sal}
                 from   emp e with insert update delete
                 where  d.deptno = e.deptno ]}
from dept d with insert update delete;

commit;

declare
  req varchar2(10000) := '{ 
    "view_name":"TEST_1",
    "tables": ["users","photo"],
    "columns":[
        {"col":"uuid","table":"users","alias":"uuid"},
        {"col":"uuid","table":"photo","alias":"puuid"},
        {"col":"name","table":"users","alias":"name"},
        {"col":"pid","table":"photo","alias":"pid"},
        {"col":"uname","table":"photo","alias":"uname"}
    ],
  "joins": [
    {
      "type" : "INNER JOIN",
      "parent_table":"users",
      "child_table":"photo",
      "conditions":{
        "logic": "AND",
        "clauses": [
          {
            "parent_field": "uuid",
            "op": "=",
            "child_field": "uuid"
          },
          {
            "parent_field": "uuid",
            "op": "=",
            "child_field": "uuid"
          }
        ]
      }
    }
  ]
  }';
  req_obj json_object_t;
  view_name varchar2(100);
  p_res     json_object_t;
  status number;
BEGIN
  req_obj := json_object_t.parse(req);
  obaas.OBAAS_SETUP_JOIN(:project_id,req_obj,p_res,status);
  dbms_output.put_line(p_res.stringify);
end;
/


commit;

conn username/password@cdb1_pdb3;

set serveroutput on;

var project_id    VARCHAR2(100);

begin
    select project_id into :project_id from table(obaas.LIST_PROJECTS) 
        where role = 'OWNER';
end;
/

-- create 7 user profile
DECLARE
    req_1 varchar2(5000) := '{"path": ["fbprofile","baas_user"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_1 varchar2(1000) := '{"name":"baas_user","age":12}';

    req_2 varchar2(5000) := '{"path": ["fbprofile","user2"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_2 varchar2(1000) := '{"name":"user2","age":12}';

    req_3 varchar2(5000) := '{"path": ["fbprofile","user3"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_3 varchar2(1000) := '{"name":"user3","age":12}';
    
    req_4 varchar2(5000) := '{"path": ["fbprofile","user4"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_4 varchar2(1000) := '{"name":"user4","age":12}';

    req_5 varchar2(5000) := '{"path": ["fbprofile","user5"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_5 varchar2(1000) := '{"name":"user5","age":12}';

    req_6 varchar2(5000) := '{"path": ["fbprofile","user6"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_6 varchar2(1000) := '{"name":"user6","age":12}';

    req_7 varchar2(5000) := '{"path": ["fbprofile","user7"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_7 varchar2(1000) := '{"name":"user7","age":12}';


    doc_data blob;
    jobj JSON_OBJECT_T;
    sql_txt varchar2(1000);
    response_result NUMBER;
    auth json_object_t := NULL;
BEGIN
 doc_data := utl_raw.cast_to_raw(data_1);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_1,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_2);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_2,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_3);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_3,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_4);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_4,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_5);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_5,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_6);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_6,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_7);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_7,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);
END;
/
show errors;


-- create 4 subcollection name comments
DECLARE
    req_1 varchar2(5000) := '{"path": ["fbprofile","baas_user","comments"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_1 varchar2(1000) := '{"comment":"hi baas_user"}';

    req_2 varchar2(5000) := '{"path": ["fbprofile","user2","comments"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_2 varchar2(1000) := '{"comment":"hi user2"}';

    req_3 varchar2(5000) := '{"path": ["fbprofile","user3","comments"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_3 varchar2(1000) := '{"comment":"hi user3"}';
    
    req_4 varchar2(5000) := '{"path": ["fbprofile","user4","comments"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_4 varchar2(1000) := '{"comment":"hi user4"}';
    doc_data blob;
    jobj JSON_OBJECT_T;
    sql_txt varchar2(1000);
    response_result NUMBER;
    auth json_object_t := NULL;
BEGIN
 doc_data := utl_raw.cast_to_raw(data_1);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_1,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_2);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_2,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_3);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_3,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);

 doc_data := utl_raw.cast_to_raw(data_4);
 obaas.OBAAS_DB_SETDOC(:project_id, doc_data,req_4,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);


END;
/
show errors;
 

-- build collection group with 4 subcollection
DECLARE
  req json_object_t := json_object_t.parse('{"col_name":"comments","order":["ASC"],"type":"btree","fields":["comment"],"fieldtypes":["string"]}');
  status number;
  l_response JSON_OBJECT_T;
BEGIN
  OBAAS.OBAAS_DB_BUILD_COLLECTIONGROUP(:project_id,req,l_response, status);
  dbms_output.put_line(status);
END;
/

DECLARE

    req_2 varchar2(5000) := '{"path": ["fbprofile","user4","comments"],"conditions" :[], 
                          "explicitOrder":[],
                          "joins":[],
                          "limit":0,
                          "options":{"merge":false},
                          "BEGIN_TRANS":0,
                          "END_TRANS":0,
                          "TRANS_NAME":""
                          }';
    data_2 varchar2(1000) := '{"comment":"hi user4 again"}';
    doc_data blob;
    jobj JSON_OBJECT_T;
    sql_txt varchar2(1000);
    response_result NUMBER;
    auth json_object_t := NULL;
BEGIN
 doc_data := utl_raw.cast_to_raw(data_2);
 obaas.OBAAS_DB_ADDDOC(:project_id, doc_data,req_2,auth,jobj ,response_result);
 dbms_output.put_line('Status : ' || response_result);
 dbms_output.put_line(jobj.stringify);
END;
/

select json_object(cgroup_v) from baas_cgroup;

commit;